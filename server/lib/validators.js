export const isEmail = (value) => /.+@.+\..+/.test(value || "");

export const validatePassword = (value) => typeof value === "string" && value.length >= 6;

export const validateRequired = (value) => value !== undefined && value !== null && value !== "";
