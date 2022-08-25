export const capitalize = (str: string) =>
    `${str.charAt(0).toUpperCase()}${str.slice(1)}`;

export const filterObject = <T extends Record<any, any>>(obj: T) =>
    Object.fromEntries(Object.entries(obj).filter(kv => !!kv[1])) as Partial<T>;
