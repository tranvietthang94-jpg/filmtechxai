---
title: "Building a restaurant telephony AI host with Amazon Bedrock AgentCore and Amazon Nova 2 Sonic"
description: "In this post, we show you how to build a voice ordering system that answers a phone number and takes the order from greeting to confirmation. The system uses Am"
pubDatetime: 2026-07-16T15:50:52.000Z
author: "AWS Machine Learning Blog"
tags: ["ai", "aws-machine-learning-blog"]
ogImage: "https://d2908q01vomqb2.cloudfront.net/artifacts/DBSBlogs/ml-21038/Recording-Audio-Normalied.mp4"
featured: false
draft: false
---

![Building a restaurant telephony AI host with Amazon Bedrock AgentCore and Amazon Nova 2 Sonic](<https://d2908q01vomqb2.cloudfront.net/artifacts/DBSBlogs/ml-21038/Recording-Audio-Normalied.mp4>)

In this post, we show you how to build a voice ordering system that answers a phone number and takes the order from greeting to confirmation. The system uses Amazon Bedrock AgentCore to host and run the agent and Amazon Nova 2 Sonic for real-time speech, connected to a restaurant backend through the Model Context Protocol (MCP). The walkthrough covers deploying the full stack with AWS Cloud Development Kit (AWS CDK) and bridging a phone call into the agent through a Session Initiation Protocol (SIP) gateway on Amazon Elastic Container Service (Amazon ECS) and AWS Fargate. It also warms the agent session while the phone is still ringing, so the caller never hears dead air.

---

*Đọc đầy đủ tại: [AWS Machine Learning Blog](<https://aws.amazon.com/blogs/machine-learning/building-a-restaurant-telephony-ai-host-with-amazon-bedrock-agentcore-and-amazon-nova-2-sonic/>)*
