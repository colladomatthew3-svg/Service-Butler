"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarkdownContent = MarkdownContent;
function MarkdownContent({ content }) {
    const blocks = parseMarkdown(content);
    return (<div className="prose prose-neutral max-w-none">
      {blocks.map((block, index) => {
            if (block.type === "h2") {
                return (<h2 key={index} className="mt-12 font-heading text-3xl font-semibold tracking-tight text-semantic-text">
              {block.text}
            </h2>);
            }
            if (block.type === "h3") {
                return (<h3 key={index} className="mt-8 font-heading text-2xl font-semibold tracking-tight text-semantic-text">
              {block.text}
            </h3>);
            }
            if (block.type === "list") {
                return (<ul key={index} className="mt-5 space-y-3 pl-5 text-base leading-8 text-semantic-muted">
              {block.items.map((item) => (<li key={item}>{item}</li>))}
            </ul>);
            }
            if (block.type === "quote") {
                return (<blockquote key={index} className="mt-8 rounded-3xl border border-semantic-border bg-semantic-surface2 px-6 py-5 text-lg leading-8 text-semantic-text">
              {block.text}
            </blockquote>);
            }
            return (<p key={index} className="mt-5 text-base leading-8 text-semantic-muted">
            {block.text}
          </p>);
        })}
    </div>);
}
function parseMarkdown(content) {
    const lines = content.split("\n");
    const blocks = [];
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index].trim();
        if (!line) {
            continue;
        }
        if (line.startsWith("## ")) {
            blocks.push({ type: "h2", text: line.replace("## ", "") });
            continue;
        }
        if (line.startsWith("### ")) {
            blocks.push({ type: "h3", text: line.replace("### ", "") });
            continue;
        }
        if (line.startsWith("> ")) {
            blocks.push({ type: "quote", text: line.replace("> ", "") });
            continue;
        }
        if (line.startsWith("- ")) {
            const items = [line.replace("- ", "")];
            while (lines[index + 1]?.trim().startsWith("- ")) {
                index += 1;
                items.push(lines[index].trim().replace("- ", ""));
            }
            blocks.push({ type: "list", items });
            continue;
        }
        const paragraphLines = [line];
        while (lines[index + 1] && lines[index + 1].trim() && !isBlockStart(lines[index + 1].trim())) {
            index += 1;
            paragraphLines.push(lines[index].trim());
        }
        blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
    }
    return blocks;
}
function isBlockStart(line) {
    return line.startsWith("## ") || line.startsWith("### ") || line.startsWith("- ") || line.startsWith("> ");
}
