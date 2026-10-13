// An app's declaration written back out as the JS that would declare it, to paste to an agent or
// diff against the source.
import type { InspectedApp } from '@holistics/anfra-sdk/common';
import { controlMappings, crossFilters } from './checks';

/**
 * Strips the indentation the code was written with. The first line is usually trimmed already
 * (`aql: \`explore {`), so the common indent comes from the lines after it.
 */
export function dedent(text: string): string {
  const lines = text.replace(/\t/g, '  ').trim().split('\n');
  const indentOf = (line: string) => line.length - line.trimStart().length;
  const rest = lines.slice(1).filter((line) => line.trim());
  const indent = rest.length ? Math.min(...rest.map(indentOf)) : 0;
  return lines
    .map((line, i) => (i ? line.slice(Math.min(indent, indentOf(line))) : line).trimEnd())
    .join('\n');
}

const json = (value: unknown) => JSON.stringify(value);

/** A name as JS can use it as a variable, or the name as written when it can't. */
const variable = (name: string) => (/^[A-Za-z_$][\w$]*$/.test(name) ? name : `/* ${name} */ _`);

export function declarationCode(app: InspectedApp): string {
  const { queries, filters, dateDrills } = app.declaration;
  const blocks: string[][] = [[], [], [], []];

  for (const [name, query] of Object.entries(queries)) {
    const aql = dedent(query.aql)
      .split('\n')
      .map((line) => (line ? `    ${line}` : line))
      .join('\n');
    const pageSize = query.pageSize ? `\n  pageSize: ${query.pageSize},` : '';
    blocks[0]?.push(
      `const ${variable(name)} = app.createQuery(${json(name)}, {\n  dataset: ${json(query.dataset)},${pageSize}\n  aql: \`\n${aql}\n  \`,\n});`,
    );
  }
  for (const [name, filter] of Object.entries(filters)) {
    blocks[1]?.push(`const ${variable(name)} = app.createFilter(${json(name)}, ${json(filter)});`);
  }
  for (const [name, drill] of Object.entries(dateDrills)) {
    blocks[1]?.push(`const ${variable(name)} = app.createDateDrill(${json(name)}, ${json(drill)});`);
  }
  for (const m of controlMappings(app)) {
    const options = m.aggregation ? { field: m.field, aggregation: m.aggregation } : { field: m.field };
    blocks[2]?.push(`app.mapControl(${variable(m.from.name)}, ${variable(m.to.name)}, ${json(options)});`);
  }
  for (const c of crossFilters(app)) {
    blocks[3]?.push(`app.mapCrossFilter(${variable(c.from.name)}, ${variable(c.to.name)});`);
  }
  return blocks
    .filter((lines) => lines.length)
    .map((lines) => lines.join('\n'))
    .join('\n\n');
}
