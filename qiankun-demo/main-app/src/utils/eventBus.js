class Emitter {
  constructor() {
    this.events = {};
    this.watchers = [];
  }

  on (event, callback) {
    this._add(event, callback, false);
  }

  once (event, callback) {
    this._add(event, callback, true);
  }

  off (event, callback) {
    const list = this.events[event] || [];
    if (!callback) {
      this.events[event] = [];
    } else {
      this.events[event] = list.filter(item => item.callback !== callback);
    }
  }

  emit (event, ...args) {
    (this.events[event] || []).forEach(({ callback, once }) => {
      callback(...args);
      if (once) this.off(event, callback);
    });

    this.watchers.forEach(fn => fn(event, ...args));
  }

  watch (fn) {
    if (typeof fn === 'function') {
      this.watchers.push(fn);
    }
  }

  _add (event, callback, once = false) {
    if (!event || typeof callback !== 'function') return;
    this.events[event] = this.events[event] || [];
    const exists = this.events[event].some(item => item.callback === callback);
    if (!exists) {
      this.events[event].push({ callback, once });
    }
  }
}

const eventBus = new Emitter();

// 挂到全局变量，供主/子应用共享
if (!window._QIANKUN_EVENT_BUS_) {
  window._QIANKUN_EVENT_BUS_ = eventBus;
}

export default eventBus;
