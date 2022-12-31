import { type FastifyInstance } from 'fastify';


export default async function pdfServiceDemoUI(instance: FastifyInstance) {
  instance.get('/', async (_, reply) => {
    reply.type('text/html; charset=utf8');

    // TODO: add options
    return `
      <!DOCTYPE html>
      <script>
        async function prepareFormdata(fd) {
          const options = {};
          const removeKeys = [];
          for (const [k,v] of fd.entries()) {
            if (k.startsWith('options.')) {
              if (k.startsWith('options.margin.')) {
                options.margin ??= {};
                options.margin[k.replace(/options\.margin\./, '')] = v;
              } else if (k.match(/displayHeaderFooter|landscape|preferCSSPageSize/)) {
                options[k.replace(/options\./, '')] = true;
              } else if (k === 'options.scale') {
                options.scale = +v;
              } else {
                options[k.replace(/options\./, '')] = v;
              }
              removeKeys.push(k);
            }
          }
          removeKeys.forEach(k => fd.delete(k));
          fd.append('options', JSON.stringify(options));
        }
      </script>
      <form enctype=multipart/form-data method=post onformdata='prepareFormdata(event.formData)' target=pdf-result>
        <label>
          HTML file
          <br>
          <input type=file name=html accept=application/html,.html>
        </label>
        <p>
        <label>
          display header/footer templates
          <input type=checkbox name=options.displayHeaderFooter>
        </label>
        <p>
        <label>
          footer template
          <textarea name=options.footerTemplate></textarea>
        </label>
        <p>
        <label>
          header template
          <textarea name=options.headerTemplate></textarea>
        </label>
        <p>
        <fieldset>
          <legend>margins</legend>
          <label>
            top <input name=options.margin.top size=2>
          </label>
          <label>
            right <input name=options.margin.right size=2>
          </label>
          <label>
            bottom <input name=options.margin.bottom size=2>
          </label>
          <label>
            left <input name=options.margin.left size=2>
          </label>
        </fieldset>
        <p>
        <button type=submit>Do it</button>
      </form>
      <p>
      <pre class=error-log></pre>
      <hr>
      <iframe name=pdf-result style='width: 100%; height: 75vh;'>
    `;
  });
}
