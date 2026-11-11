import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import Home from '../client/pages/Home';

// Renders the real dashboard once, with no network or database: react-query
// does not fetch during server rendering, so the clients list stays pending.
// wouter's ssrPath supplies the location that a browser would otherwise provide.
function renderDashboard(): string {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkup(
    createElement(QueryClientProvider, { client: queryClient }, createElement(Router, { ssrPath: '/', children: createElement(Home) })),
  );
}

const html = renderDashboard();
const sectionHeadings = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());

test('dashboard tools section is headed "All Tax Planning Tools"', () => {
  assert.ok(sectionHeadings.includes('All Tax Planning Tools'), `section headings: ${JSON.stringify(sectionHeadings)}`);
});

test('the old "Tax Planning Tools" heading text is no longer used', () => {
  assert.ok(!sectionHeadings.includes('Tax Planning Tools'), `section headings: ${JSON.stringify(sectionHeadings)}`);
});

test('the tools section still shows its three cards in order', () => {
  const start = html.indexOf('All Tax Planning Tools');
  const cards = [...html.slice(start).matchAll(/<h4[^>]*>([^<]+)<\/h4>/g)].map((m) => m[1]).slice(0, 3);
  assert.deepEqual(cards, ['S Corp Calculator', 'Tax Savings Analyzer', 'All Clients']);
});
