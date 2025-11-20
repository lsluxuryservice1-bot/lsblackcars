export default async function handler(request) {
  const encoder = new TextEncoder();
  let timer;
  const stream = new ReadableStream({
    start(controller) {
      const send = (data) => {
        const chunk = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(chunk));
      };
      send({ items: [{ title: 'Premium Chauffeur', code: 'PREMIUM' }] });
      timer = setInterval(() => {
        const msg = { ts: Date.now(), items: [{ title: 'Premium Chauffeur', code: 'PREMIUM' }] };
        send(msg);
      }, 15000);
    },
    cancel() {
      if (timer) clearInterval(timer);
    }
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
