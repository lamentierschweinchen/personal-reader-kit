import {validateBook,sha256} from './core.mjs';
import {canonical} from './bundle.mjs';

// Reviewed complete edition, including images, typography, metadata and notices.
// Independent of the download so a private bundle can restore an unavailable book.
export const EDITION_ID='dracula';
export const EDITION_SHA256='1e227b4817a4523fe1f9235c4504aaf267c6b6e1c01fac59cbd1c9fe96b66eec';
export async function isReviewedEdition(book){
  return book.id===EDITION_ID&&await sha256(new TextEncoder().encode(canonical(validateBook(book))))===EDITION_SHA256;
}
