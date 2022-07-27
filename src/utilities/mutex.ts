/**
 * Mutual exclusive access primitive based on Promise
 */
export default class Mutex {
  #allowConcurrentRead;
  #locked = false;
  #request: Function[] = [];
  constructor(allowConcurrentRead: boolean = false) {
    this.#allowConcurrentRead = allowConcurrentRead;
  }
  /**
   * Try to lock the mutex
   * @returns promise that resolves to a callback function where caller must call to release it
   */
  tryLock(): Promise<Function> {
    if (!this.#locked) {
      //if this is not locked then lock it and resolve it immediately
      this.#locked = true;
      return Promise.resolve(this.#release.bind(this));
    } else {
      return new Promise((resolve) => {
        this.#request.push(resolve);
      });
    }
  }
  /**
   * Try to lock the mutex but caller must not temper the data
   */
  tryLockRead(): Promise<Function> {
    if (this.#locked && this.#allowConcurrentRead) {
      return Promise.resolve(() => {});
    } else {
      return this.tryLock();
    }
  }
  /**
   * Release the current lock and pass to next
   */
  #release(): void {
    if (this.#request.length > 0) {
      //resolve the promise in queue
      this.#request[0](this.#release.bind(this));
      this.#request.shift();
    } else {
      this.#locked = true;
    }
  }
}
