Is MCP creation also irrelevant now in AI ?

Short answer: no, but the scope narrowed a lot, and the narrowing is what people mistake for death.

What actually happened. The "Skills killed MCP" wave was real but partial. Many MCP servers were just thin API wrappers that shouldn't have existed, and Skills exposed that. Procedural knowledge, coding conventions, "how we do X here" all migrated to skills, because a markdown file with progressive disclosure beats injecting 300 tool schemas into context on every cold start. 
Tech-insider

What stayed with MCP: live authenticated systems. Databases, cloud infra, SaaS with real read/write. There is no static skill that substitutes for a live DB connection or an authenticated Jira write. The mental model that survived: skills teach the agent, MCP lets it act. 
Peterkellner

The numbers say it is not dying. MCP hit 110M monthly SDK downloads in 16 months, the official registry sits around 9,652 servers with PulseMCP tracking 16,500+, and it is now Linux Foundation governed. That is an ecosystem consolidating into infrastructure, not collapsing. 
Digital Applied Team
Shareuhack

Timing matters if you touch it this week. The 2026-07-28 spec finalizes on July 28, and it is the biggest revision since launch: stateless core, sessions and the initialize handshake removed, extensions framework, formal deprecation policy. Anything you build against the old stateful assumptions gets a migration bill. 
Stacktree

The honest read for your situation. Two different questions hiding in yours:

As a product bet: building generic MCP servers is commoditized, same verdict as the job-scraper tool. Ten thousand of them exist. Skip it.

As a career skill: writing one is an afternoon. Not a differentiator. What is actually scarce and hireable is agent architecture judgment: knowing when a task is a skill, when it needs MCP, when a plain CLI wins, and handling the auth and security layer. Security researchers flagged in 2026 that one compromised server can pivot across an organization's entire connected toolchain, and almost nobody has that expertise. 
Tech-insider

Which of those two were you asking?