import test from "node:test"
import assert from "node:assert/strict"
import {
  buildChatEmailContent,
  extractCodeAttachments,
} from "../lib/services/sendSmtpEmail.ts"

test("buildChatEmailContent renders fenced code blocks into rich HTML", () => {
  const content = buildChatEmailContent(`Here is a simple "Hello World" program in C++:

\`\`\`cpp
#include <iostream>

int main() {
    std::cout << "Hello, World!" << std::endl;
    return 0;
}
\`\`\`
`)

  assert.match(content.text, /Hello, World!/)
  assert.match(content.html, /<pre/)
  assert.match(content.html, /CPP/)
  assert.match(content.html, /&lt;iostream&gt;/)
})

test("buildChatEmailContent renders bullet lists and inline markdown", () => {
  const content = buildChatEmailContent(`## Explanation

- Use **iostream** for output
- Print with \`std::cout\`
`)

  assert.match(content.html, /<h3/)
  assert.match(content.html, /<ul/)
  assert.match(content.html, /<strong>iostream<\/strong>/)
  assert.match(content.html, /<code/)
})

test("extractCodeAttachments creates code file attachments from fenced blocks", () => {
  const attachments = extractCodeAttachments(`Here is the code:

\`\`\`cpp
#include <iostream>
int main() { return 0; }
\`\`\`

\`\`\`ts
export const answer = 42
\`\`\`
`)

  assert.equal(attachments.length, 2)
  assert.equal(attachments[0]?.filename, "artifact.cpp")
  assert.match(attachments[0]?.content ?? "", /iostream/)
  assert.equal(attachments[1]?.filename, "artifact-2.ts")
  assert.match(attachments[1]?.content ?? "", /answer = 42/)
})
