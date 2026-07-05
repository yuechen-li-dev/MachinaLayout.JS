export function tuple(...values) {
    return values;
}
export function object(value) {
    return value;
}
export function keys(value) {
    return Object.keys(value);
}
export const CT = {
    tuple,
    object,
    keys,
};
