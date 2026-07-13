---
title: "How to shrink the token budget without shrinking the team"
description: "Jensen Huang has a test for whether an engineer is worth keeping, and it comes with a token budget attached. Speaking on the All-In Podcast at the close of GTC "
pubDatetime: 2026-07-10T09:34:27.000Z
author: "AI News"
tags: ["ai", "ai-news"]
ogImage: ""
featured: false
draft: false
---

Jensen Huang has a test for whether an engineer is worth keeping, and it comes with a token budget attached. Speaking on the All-In Podcast at the close of GTC 2026, the Nvidia chief executive said that if a $500,000 engineer&#8217;s annual AI token consumption came in under half their salary, &#8220;I am going to [&#8230;]
The post How to shrink the token budget without shrinking the team appeared first on AI News.

Jensen Huang has a test for whether an engineer is worth keeping, and it comes with a token budget attached. Speaking on the All-In Podcast at the close of GTC 2026, the Nvidia chief executive said that if a $500,000 engineer&#8217;s annual AI token consumption came in under half their salary, &#8220;I am going to be deeply alarmed.&#8221; Nvidia, he confirmed, is working toward a $2 billion yearly token bill for its engineering force.



He was describing a trade-off most companies have already made with less fanfare: money that once paid people increasingly pays for tokens. The four largest hyperscalers have guided roughly $700 billion in combined 2026 capital expenditure, nearly double last year, while data from outplacement firm Challenger, Gray &amp; Christmas shows AI as the most-cited reason for US job cuts for a record fourth consecutive month. 



An internal Meta memo obtained by Reuters described May&#8217;s cuts of 8,000 roles as offsetting the company&#8217;s substantial investments, in a quarter when revenue grew 33%. The layoffs at companies like these aren&#8217;t survival measures. They&#8217;re financing.



The trouble is that the financing hasn&#8217;t bought what it promised. Gartner surveyed 350 executives at companies with over $1 billion in revenue, all deploying AI agents or automation, and found roughly 80% had cut headcount with no correlation to improved returns. Analyst Helen Poitevin&#8217;s verdict was blunt: &#8220;Workforce reductions may create budget room, but they do not create return.&#8221; 



Uber learned the token side of that lesson the expensive way, giving 5,000 engineers AI coding tools in December and exhausting its entire 2026 AI budget by April. Chief Operating Officer Andrew Macdonald conceded that despite 70% of committed code being AI-generated, the connection to anything customers notice is missing: &#8220;That link is not there yet.&#8221;



Put those two failures side-by-side and the actual problem comes into focus. Companies treated the token bill as fixed and the workforce as flexible, when the opposite is true. Payroll cuts happen once and take institutional knowledge with them. A token budget, it turns out, bends in half a dozen places if anyone bothers to engineer it.



Where the token budget bends



The cheapest fix is also the least glamorous: stop paying to process the same text repeatedly. Prompt caching, now standard across the major API providers, cuts the cost of repeated input by up to 90% under Anthropic&#8217;s and OpenAI&#8217;s published pricing, because static content like system instructions and reference documents gets processed once and reread at a fraction of the rate. 



Security firm ProjectDiscovery documented raising its cache hit rate from 7% to 84% by restructuring prompts, cutting its total LLM spend by 59 to 70% while serving 9.8 billion tokens from cache. That single engineering exercise recovered more budget than most AI-attributed layoff rounds save.



The next lever is routing work to the right-sized model. Providers&#8217; own price lists show flagship models costing five times their smaller siblings per token, yet plenty of production workloads send routine classification and summarisation to the most expensive tier by default. Batch processing adds a further 50% discount for anything that doesn&#8217;t need a real-time answer.



Retrieval-augmented generation attacks the problem from another angle by sending the model only the relevant slice of a knowledge base rather than the whole thing, and prompt compression trims the redundant examples that inflate every call. Open-weight models reduce costs further still, handling routine workloads at a fraction of frontier API prices for teams willing to manage the infrastructure.



These measures are simply the AI equivalent of turning off the lights in empty rooms, and Uber&#8217;s $1,500 monthly cap per engineer – imposed after the April overrun – is early evidence that spending discipline arrives eventually. The companies getting ahead are simply choosing it before the budget forces it.



The other half of the fix is human



Optimising the token bill only matters if the savings go somewhere productive, and the strongest evidence points at people. Poitevin&#8217;s research found the organisations that improved ROI were those using AI to amplify their workforce rather than replace it.



Klarna ran the controlled experiment on everyone&#8217;s behalf, replacing roughly 700 customer service roles with an OpenAI-powered assistant before customer satisfaction fell. Chief Executive Sebastian Siemiatkowski told Bloomberg what few executives admit aloud: &#8220;The result was lower quality, and that&#8217;s not sustainable.&#8221;



The fintech now runs a blended model, with AI absorbing routine volume while rehired humans handle everything requiring judgment. Gartner expects the pattern to spread, predicting that by 2027 half the companies that cut customer service staff for AI will rehire them.



There&#8217;s one workforce investment the optimisation logic makes urgent rather than optional. Stanford University&#8217;s Institute for Human-Centered AI found employment for software developers aged 22 to 25 fell nearly 20% from 2024 levels even as older cohorts grew, which means companies are removing the training ground for the senior engineers they&#8217;ll need directing all these systems in five years. 



A business that has just engineered 60% off its token bill has the budget room to keep hiring at the bottom rung. Whether it does is a leadership decision, not a financial one.



Nvidia&#8217;s Huang&#8217;s provocation will keep echoing through earnings calls, and the capex numbers will keep climbing. The companies that come out ahead won&#8217;t be the ones that spent the most on tokens or cut the most people to afford them—they&#8217;ll be the ones that noticed the token budget was the flexible line all along, squeezed it with engineering rather than headcount, and spent the difference on the people who make the tokens worth anything.



(Image by kate.sade)



See also: Per-token AI charges come to GitHub Copilot







Want to learn more about AI and big data from industry leaders? Check out AI &amp; Big Data Expo taking place in Amsterdam, California, and London. The comprehensive event is part of TechEx and is co-located with other leading technology events including the Cyber Security &amp; Cloud Expo. Click here for more information.



AI News is powered by TechForge Media. Explore other upcoming enterprise technology events and webinars here.
The post How to shrink the token budget without shrinking the team appeared first on AI News.

---

*Đọc đầy đủ tại: [AI News](https://www.artificialintelligence-news.com/news/shrink-token-budget-not-team/)*
