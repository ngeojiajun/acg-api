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

/**
 * Perform the cast as `as***` functions but also strip off the unneeded properties
 * @param object Object to cast
 * @param converter The function which performs the conversion, use `defineVerifiedChain(....)` to define the list of the retained properties
 * @returns The casted object or null on failure
 * @notes if the list is not present it act like an alias to the converter
 */
export function castAndStripObject<T>(
  object: any,
  converter: (e: any) => T | null
): T | null {
  //first try to cast to the T
  let casted = converter(object);
  if (!casted) {
    return null;
  }
  if (!Array.isArray((converter as any).checkedList)) {
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

/**
 * Patch the `object` using the delta provided
 * @param object The original object that is going to be patched
 * @param delta The update to be applied
 * @param converter The function which converts to the original type of the object. Required for validation
 * @param ignore List of keys that should not be patched
 * @returns the patched object or null if the patch produced an invalid object
 */
export function patchObjectSecure<T>(
  object: T,
  delta: any,
  converter: (e: any) => T | null,
  ignore: string[] = ["id"]
): T | null {
  //make a copy of the object
  let copied: any = { ...object };
  let checkedList: Array<string> = (converter as any).checkedList;
  if (!Array.isArray(checkedList)) {
    throw new Error(
      "Cannot safely patch the object, the checked list must present"
    );
  }
  //for each found properties excluding those outside the checkedList and inside
  //the ignore list
  let keys = Object.keys(delta).filter(
    (t) => !ignore.includes(t) && checkedList.includes(t)
  );
  //copy those into the main object
  for (const key of keys) {
    copied[key] = delta[key];
  }
  return converter(copied);
}
