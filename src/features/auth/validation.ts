export function validName(value: string): boolean {
  return (
    value.length >= 1 &&
    value.length <= 80 &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}
export function validEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
}
export function validPassword(value: string): boolean {
  return value.length >= 8 && value.length <= 128;
}
export function textField(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === "string" ? value : "";
}
