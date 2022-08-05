/**
 * Ambient definition for the patches
 */
interface String {
  /**
   *Same like includes() but it is case insensitive
   */
  includesIgnoreCase: (rhs: string) => boolean;
  /**
   *Same like equals() but it is case insensitive
   */
  equalsIgnoreCase: (rhs: string) => boolean;
}
