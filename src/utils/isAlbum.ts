export function isAlbum(url: string): boolean {
  return url.split("/")[3]?.includes("albums") ?? false;
}
