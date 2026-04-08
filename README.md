## Quotomotion

An MCP-driven CPQ solution for the Salesfoce platform. 


## Directory

[Concept](./cpq_mcp_concept.md)

[Overview](./cpq_mcp_architecture.svg)

[Examples](./cpq_agent_conversation.md)


## Of Note

This is an 80% feature complete solution. For this to hit 100%:

- Unit tests need to be built to support both sympathetic and adversarial scenarios. 

- Some obfuscation and request anonymization.

- The Salesforce agent implementation needs to be built in an org that has real-world, moderately complex product configurations. In the interest of time, this is the remaining big chunk of work. The overview diagram details how everything fits together, including any code that is having "hands waved over it for the moment."

- Bun is the recommended JavaScript environment. NPM and Node have becone severely compromised via a rogue state actor's "supply chain" attack against the package repository.

- Everything is subject to massive changes. One need only look at the last year for evidence.

- 2025 was supposed to be the 'Year of the Agent' and instead, MCP has become a major tool in the effort ito integrate agents with "actions", where "actions" is defined as tool usage and not necessarily as defined by the Salesforce ecosystem (where Actions are done by agents on topics, for example.)

- One major design flaw in the MCP spec is that it only supports two communication channels: STDIO and SSE (server-side events.)  Server Side Events function like unidirection WebSockets (they stream from the sr)

- This project was built in collaboration with (not in deference to) Claude Code.  While it could be said that using a coding assistant in this context may violate a predetermined rule, I would argue that without demonstrating this skill there is no way to really know if an individual has the proper "AI intuitive" skillset required for more complex engagements.

Justn Stroud

