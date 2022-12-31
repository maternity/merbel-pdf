import EventEmitter from 'events';

export interface Semaphore {
  apply<T>(fn: () => PromiseLike<T>): Promise<T>;
  events: EventEmitter;
}

export default function semaphore(size: number): Semaphore {
  type Task<T> = () => PromiseLike<T>;

  type Pending<T> = {
    fn: Task<T>,
    resolve: (v: T | PromiseLike<T>) => void,
  };

  let n = size;
  const pending: Pending<any>[] = [];
  const ee = new EventEmitter();

  return {apply, events: ee};

  function apply<T>(fn: Task<T>) {
    if (n == 0)
      return queue(fn);
    return run(fn);
  };

  function queue<T>(fn: Task<T>) {
    return new Promise<T>((resolve) => {
      pending.push({fn, resolve});
    });
  }

  async function run<T>(fn: Task<T>) {
    if (n === size)
      ee.emit('deidle');
    n--;
    try {
      return await fn();
    } finally {
      n++;
      if (pending.length > 0) {
	const {fn, resolve} = pending.shift()!;
	resolve(run(fn));
      } else if (n === size) {
	ee.emit('idle');
      }
    }
  }
}

import tp from 'timers/promises';

async function test() {
  const sem = semaphore(3);
  const job = (n: any) => async () => {
    console.log('doodoo', n);
    await tp.setTimeout(1e3);
    return n;
  }

  sem.apply(job(1)).then((n) => console.log('completed', n));
  sem.apply(job(2)).then((n) => console.log('completed', n));
  sem.apply(job(3)).then((n) => console.log('completed', n));
  sem.apply(job(4)).then((n) => console.log('completed', n));
  sem.apply(job(5)).then((n) => console.log('completed', n));
  EventEmitter.once(sem.events, 'idle').then(() => console.log('idle'));
}


if (require.main === module)
  test();
