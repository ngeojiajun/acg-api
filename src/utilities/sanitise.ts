type PropList = string | Function;

/**
 * Define the list of property that the function has verified
 * @param base the base function that the property should be attached to
 * @param PropList the list of verified props
 */
export function defineVerifiedChain(
  base: Function,
  ...PropList: PropList[]
): void {
  const checkedProps = new Set<string>();
  //iterate all props and add into the list
  for (const element of PropList) {
    if (element instanceof Function) {
      //if it is function check the presence of checkedList
      if (Array.isArray((element as any).checkedList)) {
        //add all string into it
        (element as any).checkedList
          .filter((e: any) => typeof e == "string")
          .map((e: string) => checkedProps.add(e));
      }
    } else {
      checkedProps.add(element);
    }
  }
  //define it directly
  (base as any).checkedList = [...checkedProps];
}

export function castAndStripObject<T>(
  object: any,
  converter: (e: any) => T | null
): T | null {
  //first try to case to the T
  let casted = converter(object);
  if (!casted) {
    return null;
  }
  if (!Array.isArray((converter as any).checkList)) {
    return { ...casted };
  }
  //if there is the check list lets strip the unneeded
  const arr = (converter as any).checkedList as any[];
  casted = { ...casted }; //make a copy of the object
  Object.keys(casted)
    .filter((e) => !arr.includes(e))
    .forEach((e) => {
      delete (casted as any)[e];
    });
  return casted;
}
