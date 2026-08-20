export function adminSseTicketKey(ticket: string): string {
  return `admin-sse-ticket:${ticket}`;
}
