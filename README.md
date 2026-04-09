## Quotomotion

An MCP-driven CPQ solution for the Salesfoce platform. 

# Please note: This is my 'scratch pad' that I update pretty regularly, but it's not structured and is not a formal spec. [Go here](./cpq_mcp_concept.md) for that document.

## Usage

Since this is currently only working in stdio, the only thing that has to happen is to configure the MCP server with your SF credentials. Please...use .env or similar. Free text in the wild is bad news.

For reference, here is a working CPQ conversation initialed:

<img width="820" height="682" alt="image" src="https://github.com/user-attachments/assets/c3e3719f-293c-478a-a29a-2be79b1025cd" />


And look, we hit our first limitation (or opportunity, as it were):
<img width="739" height="466" alt="image" src="https://github.com/user-attachments/assets/ba6c9eaf-1665-4468-8c7d-ef8967c0720d" />


## Coming Soon

-Actual installation instructions

-A tutorial of sorts to get the most out of qwoting through an agentic AI.

-Server Side Events with just enough state to be interesting

-Salesforce Agent integration

## Directory

[Concept](./cpq_mcp_concept.md)

[Overview](./cpq_mcp_architecture.svg)

[Examples](./cpq_agent_conversation.md)


## Of Note

This is a theroetical exercise of a solution that works in a generic sense, and would need to be modified in order o better fit an org in the wild.

To that end, this is also an 80% feature complete architecture. For this to hit 100%:

- Unit tests need to be built to support both sympathetic and adversarial scenarios. 

- Some obfuscation and request anonymization.

- The Salesforce agent implementation needs to be built in an org that has real-world, moderately complex product configurations. In the interest of time, this is the remaining big chunk of work. The overview diagram details how everything fits together, including any code that is having "hands waved over it for the moment."

- Bun is the recommended JavaScript environment. NPM and Node have becone severely compromised via a rogue state actor's "supply chain" attack against the package repository.

- Everything is subject to massive changes. One need only look at the last year for evidence.

- 2025 was supposed to be the 'Year of the Agent' and instead, MCP has become a major tool in the effort ito integrate agents with "actions", where "actions" is defined as tool usage and not necessarily as defined by the Salesforce ecosystem (where Actions are done by agents on topics, for example.)

- One major design flaw in the MCP spec is that it only supports two communication channels: STDIO and SSE (server-side events.)  Server Side Events function like unidirection WebSockets (they stream from the server.) This is great for continuous always-live conversations, but these transactions have tended more towards the back-and-forth request-response type. This butts up against the statelesss nature of SSEs. This can be mitigated in code but requires some complexity.

- This project was built in collaboration with (not in deference to) Claude Code.  While it could be said that using a coding assistant in this context may violate a predetermined rule, I would argue that without demonstrating this skill there is no way to really know if an individual has the proper "AI intuitive" skillset required for more complex engagements.

## Overall Assessment

One of the bugbears in software engineering that often gets overlooked is the shifting of commplexity from one aspect to another in service of subjective simplification.

 This approach makes that a non-issue,  as the LLM and reasoning moodel assume all complexity by their nature. It understands the loose relationships that products may have to dimensions present in the customer's specific context (how long they have been around, purchase history, any number of 'soft' qualifiers.) 
 
 Over time, these things start to take a more concrete shape. There is no "we have to make a complex attribute driven data model to support the 10^20th number of possible configurations."

Justn Stroud

