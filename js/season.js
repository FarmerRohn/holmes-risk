/* season.js — dynamic crop year management */
var SEASON = {
  get current() {
    return String(new Date().getFullYear());
  },
  get previous() {
    return String(new Date().getFullYear() - 1);
  },
  get next() {
    return String(new Date().getFullYear() + 1);
  },
  get year() {
    return new Date().getFullYear();
  },
  get label() {
    return this.current + ' Season';
  },
  get available() {
    var y = new Date().getFullYear();
    return [String(y - 1), String(y), String(y + 1), String(y + 2)];
  }
};
