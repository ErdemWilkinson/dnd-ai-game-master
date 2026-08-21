import '@testing-library/jest-dom/vitest';

// jsdom scrollIntoView'ı implemente etmiyor; ChatPanel bunu her mesaj değişiminde çağırıyor.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
