/**
 * Gerenciador de Estado Global da Aplicação SPA.
 */

class AppState {
  constructor() {
    this.user = null;
    this.settings = {};
    this.listeners = new Map();
  }

  setUser(user) {
    this.user = user;
    this.emit('user:change', user);
  }

  getUser() {
    return this.user;
  }

  isAdmin() {
    return this.user && this.user.role === 'admin';
  }

  setSettings(settings) {
    this.settings = settings;
    this.emit('settings:change', settings);
  }

  getSettings() {
    return this.settings;
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => cb(data));
    }
  }
}

export const state = new AppState();
