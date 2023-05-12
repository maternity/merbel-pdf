import {once} from 'events';

import Fastify, {FastifyServerOptions} from 'fastify';
import metrics from 'fastify-metrics';
import {ArgumentParser} from 'argparse';

import pdfService from './pdf-service';


type LoggerOptions = FastifyServerOptions['logger'];
const productionLoggingConfig: LoggerOptions = true;
const developmentLoggingConfig: LoggerOptions = {
    transport: {
      target: 'pino-pretty',
    },
  };

if (require.main === module) {
  const parser = new ArgumentParser();

  parser.add_argument('port', {metavar: 'PORT', nargs: '?', type: 'int', default: 80,
    help: 'Port to serve merbel-pdf on'});
  parser.add_argument('--concurrency', '-j', {metavar: 'N', type: 'int',
    help: 'Number of concurrent PDF conversions to process (additional '+
      'requests will queue until running requests have completed)'});

  const {port, concurrency} = parser.parse_args();

  const fastify = Fastify({
      logger: process.env.NODE_ENV === 'production'
	? productionLoggingConfig
	: developmentLoggingConfig,
    });

  fastify.register(metrics);
  fastify.register(pdfService, {concurrency});

  serve(port)
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });

  async function serve(port=0) {
    fastify.listen({host: '::', port})
    await once(process, 'SIGTERM');
    await fastify.close();
  }

}
