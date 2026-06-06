import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const themeCss = readFileSync(
      resolve(root, 'src/styles/theme.css'), 'utf8'
);

function extract(css, varName) {
      const match = css.match(
        new RegExp(varName + ':\\s*([^;]+);')
      );
        return match?.[1]?.trim() ?? null;
}

const bg   = extract(themeCss, '--color-background') ?? '#020617';
const text = extract(themeCss, '--color-text-primary') ?? '#e2e8f0';
const font = extract(themeCss, '--font-family-primary')
             ?? 'Inter, sans-serif';

const globalsCss = [
      '@import "tailwindcss";',
        '',
          '@theme inline {',
            '  --color-background: ' + bg + ';',
              '  --color-foreground: ' + text + ';',
                '  --font-sans: ' + font + ';',
                  '}',
                    '',
                      'body {',
                        '  background-color: ' + bg + ';',
                          '  color: ' + text + ';',
                            '  font-family: ' + font + ';',
                              '}',
                                ''
].join('\n');

writeFileSync(
      resolve(root, 'src/app/globals.css'), globalsCss, 'utf8'
);
console.log('Theme injected → bg:' + bg + ' text:' + text);
