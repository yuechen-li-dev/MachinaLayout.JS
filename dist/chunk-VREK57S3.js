// src/errors.ts
var MachinaLayoutError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "MachinaLayoutError";
    this.code = code;
  }
};

export {
  MachinaLayoutError
};
