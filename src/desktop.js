/* The web version has no desktop bridge. Never import Electron into React. */
export function notifyDogOfCompletion() {
  if (window.lauDesktop) void window.lauDesktop.taskCompleted().catch(error => console.warn('Dog feedback unavailable:', error.message))
}
