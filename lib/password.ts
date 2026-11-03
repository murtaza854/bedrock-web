// The password rule, the same as the server's: at least 8 characters with an uppercase letter, a lowercase letter, a number and a symbol.
export const PASSWORD_RULE = "Use at least 8 characters, with an uppercase letter, a lowercase letter, a number and a symbol.";
export const passwordProblem = (pw: string) =>
  [...pw].length < 8 ? "Use at least 8 characters"
    : !(/\p{Lu}/u.test(pw) && /\p{Ll}/u.test(pw) && /\d/.test(pw) && /[^\p{L}\d]/u.test(pw)) ? "Add an uppercase letter, a lowercase letter, a number and a symbol"
    : "";
