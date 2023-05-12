import {once} from 'events';

import {ArgumentParser} from 'argparse';
import Fastify from 'fastify';
import {type FastifyInstance} from 'fastify';
import {type FastifyServerOptions} from 'fastify';
import metricsPlugin from 'fastify-metrics';

import pdfService from './pdf-service';


type LoggerOptions = FastifyServerOptions['logger'];
const productionLoggingConfig: LoggerOptions = true;
const developmentLoggingConfig: LoggerOptions = {
    transport: {
      target: 'pino-pretty',
    },
  };


async function main() {
  const parser = new ArgumentParser();

  parser.add_argument('port', {metavar: 'PORT', nargs: '?', type: 'int', default: 80,
    help: 'Port to serve merbel-pdf on'});
  parser.add_argument('--metrics-port', {metavar: 'PORT', type: 'int',
    help: 'Port to serve metrics on'});

  parser.add_argument('--concurrency', '-j', {metavar: 'N', type: 'int',
    help: 'Number of concurrent PDF conversions to process (additional '+
      'requests will queue until running requests have completed)'});

  const {port, concurrency, metrics_port} = parser.parse_args();

  const fastify = Fastify({
      logger: process.env.NODE_ENV === 'production'
      ? productionLoggingConfig
      : developmentLoggingConfig,
    });

  if (metrics_port)
    await setupMetrics(fastify, metrics_port);

  await fastify.register(pdfService, {concurrency});

  await fastify.listen({host: '::', port})

  await once(process, 'SIGTERM');
  await fastify.close();
}

async function setupMetrics(fastify: FastifyInstance, port: number) {
  // Register the metrics plugin and serve metrics on another port
  const metricsFastify = Fastify({ logger: false });

  await fastify.register(metricsPlugin, {endpoint: null, defaultMetrics: {enabled: false}});
  await metricsFastify.register(metricsPlugin, {
      // Don't add these twice
      defaultMetrics: {enabled: false},
      // Don't care about metrics about the metrics server
      routeMetrics: {enabled: false},
    });

  fastify.addHook('onReady', async () => {
      await metricsFastify.listen({port});
    });

  fastify.addHook('onClose', async() => {
      await metricsFastify.close();
    });
}

if (require.main === module) {
    main()
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
}
