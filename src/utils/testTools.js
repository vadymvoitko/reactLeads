export const findByAttr = (component, attr) => {
  const result = component.find(`[data-test='${attr}']`);
  return result;
};
