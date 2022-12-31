import Fastify, {FastifyServerOptions} from 'fastify';
import metrics from 'fastify-metrics';

import pdfService from './pdf-service';


type LoggerOptions = FastifyServerOptions['logger'];
const productionLoggingConfig: LoggerOptions = true;
const developmentLoggingConfig: LoggerOptions = {
    transport: {
      target: 'pino-pretty',
    },
  };

const fastify = Fastify({
    logger: process.env.NODE_ENV === 'production'
      ? productionLoggingConfig
      : developmentLoggingConfig,
  });
fastify.register(metrics);
fastify.register(pdfService);

async function serve(port=0) {
  fastify.listen({host: '::', port})
}

if (require.main === module) {
  const port = process.argv.length > 2
    ? +process.argv[2]
    : undefined;

  serve(port)
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
