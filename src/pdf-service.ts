import fs from 'fs/promises';

import { type FastifyInstance } from 'fastify';
import multer from 'fastify-multer';
import { type File } from 'fastify-multer/lib/interfaces';
import S from 'fluent-json-schema';
import playwright from 'playwright';

import { browserManager } from './browser-manager';
import demoUi from './pdf-service-demo-ui';

declare module 'fastify' {
  interface FastifyRequest {
    file?: File;
  }
}

type PDFOptions = NonNullable<Parameters<playwright.Page['pdf']>[0]>;

interface PDFRequestBody {
  options?: PDFOptions;
}

type Unparsed<T> = {
  [K in keyof T]: string;
};


// See https://source.chromium.org/chromium/chromium/src/+/main:components/printing/resources/print_header_footer_template_page.html
// For how chrome's default header and footer layout work.

interface PDFServiceOptions {
}

export default async function pdfService(instance: FastifyInstance, _: PDFServiceOptions) {
  instance.register(demoUi);
  instance.register(multer.contentParser);

  const upload = multer({storage: multer.diskStorage({})});

  const browserMan = browserManager(playwright.chromium, {concurrency: 4});

  instance.post('/', {
      schema: {
        body: S.anyOf([
          S.null(),
          S.object()
            .prop('options', S.object()
              .additionalProperties(false)
              .prop('displayHeaderFooter', S.boolean())
              .prop('footerTemplate', S.string())
              .prop('format', S.string())
              .prop('headerTemplate', S.string())
              .prop('height', S.anyOf([S.string(), S.number()]))
              .prop('landscape', S.boolean())
              .prop('margin', S.object()
                .additionalProperties(false)
                .prop('top', S.anyOf([S.string(), S.number()]))
                .prop('right', S.anyOf([S.string(), S.number()]))
                .prop('bottom', S.anyOf([S.string(), S.number()]))
                .prop('left', S.anyOf([S.string(), S.number()])))
              .prop('pageRanges', S.string())
              // Disallow setting output path from API.
              .prop('path', S.null())
              .prop('preferCSSPageSize', S.boolean())
              .prop('printBackground', S.boolean())
              .prop('scale', S.number()
                .minimum(0.1)
                .maximum(2))
              .prop('width', S.anyOf([S.string(), S.number()]))
          ),
        ]),
      },
      preValidation: [
        upload.single('html'),
        async (request, _) => {
          const body = request.body as Unparsed<PDFRequestBody>;
          if (body?.options) {
            request.body = {
              options: JSON.parse(body.options),
            };
          }
        },
      ],
      preHandler: async (request, _) => {
        if (!request.file) {
          throw {
            statusCode: 400,
            message: "Missing required file attachment 'html'",
          };
        }
      },
    }, async (request, reply) => {
      const cleanUp: Array<() => unknown> = [];

      try {
        // request.file is not null, because preHandler checked it
        // request.file.path is not null because multer.diskStorage is used
        const uploadPath = request.file!.path!;
        cleanUp.push(() => fs.rm(uploadPath, {force: true}));
        const htmlPath = await setFileExtension(uploadPath, '.html');
        cleanUp.push(() => fs.rm(htmlPath, {force: true}));
        const pdfPath = uploadPath+'.pdf';

        const body = request.body as PDFRequestBody | undefined;
        const options: PDFOptions = {
          ...body?.options || {} as PDFOptions,
          path: pdfPath,
        };

        await browserMan.withBrowserContext(async (browserContext) => {
          const page = await browserContext.newPage();
          const htmlUrl = new URL(htmlPath, 'file:')+'';
          await page.goto(htmlUrl, {waitUntil: 'networkidle'});
          await page.pdf(options);
          cleanUp.push(() => fs.rm(pdfPath, {force: true}));
       });

        const pdfHandle = await fs.open(pdfPath);
        reply.type('application/pdf');
        await reply.send(pdfHandle.createReadStream());

      } finally {
        while (cleanUp.length > 0) {
          await cleanUp.pop()!();
        }
      }
    });
}

async function setFileExtension(path: string, ext: `.${string}`) {
  if (path.endsWith(ext))
    return path;

  await fs.rename(path, path+ext);

  return path+ext;
}
