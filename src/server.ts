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

const fastify = Fastify({
    logger: process.env.NODE_ENV === 'production'
      ? productionLoggingConfig
      : developmentLoggingConfig,
  });
fastify.register(metrics);
fastify.register(pdfService);

async function serve(port=0) {
  fastify.listen({host: '::', port})
  await once(process, 'SIGTERM');
  await fastify.close();
}

if (require.main === module) {
  const parser = new ArgumentParser();

  parser.add_argument('port', {metavar: 'PORT', nargs: '?', type: 'int', default: 80,
    help: 'Port to serve merbel-pdf on'});

  const {port} = parser.parse_args();

  serve(port)
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
