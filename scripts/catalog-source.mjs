// Reviewed editorial family inputs. Semicolon-separated entries are distinct skills, not generated variants.
// The build script materializes domain JSON; runtime never generates taxonomy text.
export const families = [];
function family(id, category, purpose, resource, roles, core, skills, project) {
  families.push({
    id,
    category,
    purpose,
    resource,
    roles: roles.split('; '),
    core: core.split('; '),
    skills: skills.split('; '),
    project,
  });
}

family(
  'web-interfaces',
  'development',
  'build usable browser interfaces',
  'https://developer.mozilla.org/',
  'Frontend Developer; React Developer; Vue Developer; Angular Developer; Next.js Developer; Svelte Developer; WebAssembly Developer; Design Technologist',
  'HTML; CSS; JavaScript; Accessibility',
  'TypeScript; React; Vue; Angular; Svelte; Next.js; Nuxt; Redux; Zustand; React Query; CSS Grid; Flexbox; Responsive Design; Semantic HTML; DOM Manipulation; Browser Events; Web Components; Shadow DOM; CSS Animations; CSS Custom Properties; Tailwind CSS; Sass; Vite; Webpack; Rollup; Browser DevTools; Progressive Web Apps; Service Workers; Web Performance; Core Web Vitals; Client-side Routing; Server-side Rendering; Static Site Generation; Hydration; WebAssembly; IndexedDB; Browser Storage; Forms Validation; Internationalization; Cross-browser Testing; Content Security Policy; HTTP Caching; Web Fonts; React Hooks; Vue Composition API; Angular Signals; Svelte Runes; Web Workers; Web Accessibility Testing; ARIA',
  'Build and evaluate an accessible, responsive task workspace with documented performance measurements',
);

family(
  'backend-services',
  'development',
  'deliver reliable application services',
  'https://developer.mozilla.org/',
  'Backend Developer; Full Stack Developer; Software Engineer; Node.js Developer; API Developer; Microservices Architect; Software Architect; Integration Developer',
  'REST APIs; SQL; Git; Testing',
  'Node.js; Express; NestJS; Fastify; GraphQL; gRPC; OpenAPI; API Versioning; API Pagination; API Rate Limiting; Webhooks; WebSockets; Server-sent Events; OAuth 2.0; JSON Web Tokens; Session Management; Password Hashing; Object-oriented Programming; Data Structures; Algorithms; Design Patterns; Domain-driven Design; Hexagonal Architecture; Event-driven Architecture; Microservices; Distributed Transactions; Idempotency; Message Queues; Circuit Breakers; Dependency Injection; Connection Pooling; Caching Strategies; Redis; RabbitMQ; NATS; Protocol Buffers; System Design; Load Balancing; API Gateways; Service Discovery; Concurrency; Asynchronous Programming; Error Handling; Structured Logging; Unit Testing; Integration Testing; Contract Testing; Database Transactions; Secure Coding; Software Requirements',
  'Deliver a documented service with authentication, durable storage, automated tests and a failure-recovery demonstration',
);

family(
  'language-platforms',
  'development',
  'write maintainable platform-specific applications',
  'https://learn.microsoft.com/',
  'Python Developer; Django/Flask Developer; Java Developer; Spring Boot Developer; .NET/C# Developer; Go Developer; Rust Developer; PHP/Laravel Developer; Ruby on Rails Developer; Kotlin Developer',
  'Git; Testing; Data Structures; SQL',
  'Python; Java; C#; Go; Rust; PHP; Ruby; Kotlin; Django; Flask; FastAPI; Spring Boot; Spring Security; Spring Data; Hibernate; Maven; Gradle; .NET; ASP.NET Core; Entity Framework Core; LINQ; Laravel; Eloquent ORM; Ruby on Rails; Active Record; RSpec; Go Modules; Go Goroutines; Go Channels; Rust Ownership; Rust Lifetimes; Cargo; Tokio; Python Type Hints; Python Virtual Environments; pytest; Poetry; pip; Java Streams; Java Generics; JVM Profiling; C# Async Await; NuGet; Composer; Bundler; SQLAlchemy; Pydantic; Celery; Dependency Management; Memory Management; Functional Programming; Haskell; Elixir; Erlang; Julia; Lua; Scala; C; C++',
  'Create a platform-native application with typed boundaries, persistence, tests and a reproducible build',
);

family(
  'mobile-apps',
  'development',
  'ship accessible mobile experiences',
  'https://developer.android.com/',
  'Swift/iOS Developer; Android Developer; React Native Developer; Flutter Developer; Cross-Platform Mobile Developer; Mobile App Architect',
  'Git; REST APIs; Mobile Accessibility; Mobile Application Lifecycle',
  'Swift; Dart; SwiftUI; UIKit; Jetpack Compose; Android SDK; Android Studio; Xcode; Flutter; React Native; Expo; Kotlin Coroutines; Combine; Core Data; Room Database; SQLite; Mobile Navigation; Deep Linking; Push Notifications; Offline-first Mobile Design; Mobile State Management; Mobile Networking; Mobile Secure Storage; App Signing; App Store Submission; Google Play Console; TestFlight; Mobile Crash Reporting; Mobile Performance Profiling; Mobile Unit Testing; Espresso; XCUITest; Appium; Flutter Widget Testing; React Native Testing Library; Platform Channels; Mobile Camera APIs; Mobile Location APIs; Mobile Permissions; Mobile Background Tasks; Adaptive Layouts; Mobile Localization; Mobile Analytics; Mobile CI/CD; Universal Links; Mobile Dependency Injection',
  'Ship an offline-capable mobile planner with accessibility checks and a recorded device test',
);

family(
  'games-xr',
  'development',
  'create interactive games and immersive experiences',
  'https://learn.unity.com/',
  'Game Developer (Unity); Game Developer (Unreal); AR/VR Developer; Gameplay Programmer; Technical Game Designer; XR Interaction Designer',
  'Game Design; 3D Mathematics; Game Prototyping; Version Control for Games',
  'Unity; Unreal Engine; Godot; Unity C# Scripting; Unreal Blueprints; Unreal C++; Game Physics; Collision Detection; Game Animation Systems; Game Input Systems; Game Audio Integration; Game UI; Game Save Systems; Game AI; Navigation Meshes; Behavior Trees; Finite State Machines; Game Networking; Multiplayer Replication; Shader Programming; HLSL; GLSL; Shader Graph; Render Pipelines; GPU Profiling; Game Optimization; Level Streaming; Addressable Assets; Procedural Generation; VR Interaction; AR Foundation; OpenXR; WebXR; Spatial Anchors; Hand Tracking; Motion Sickness Mitigation; XR Accessibility; Quaternion Rotations; Linear Algebra for Graphics; Game Build Pipelines; Playtesting; Game Telemetry; Game Economy Design; Interactive Narrative; Game Balancing',
  'Publish a playable vertical slice with clear controls, performance budgets and playtest findings',
);

family(
  'embedded-iot',
  'development',
  'build dependable connected hardware',
  'https://docs.zephyrproject.org/',
  'Embedded Systems Engineer; Firmware Engineer; IoT Developer; Robotics Engineer; Digital Twin Engineer; Edge Computing Engineer',
  'C; Electronics Fundamentals; Embedded Debugging; Hardware Interfaces',
  'Microcontrollers; ARM Architecture; RISC-V; Embedded C++; FreeRTOS; Zephyr; Embedded Linux; Device Drivers; Bootloaders; Interrupts; DMA; UART; SPI; I2C; CAN Bus; Modbus; MQTT; CoAP; BLE; Zigbee; LoRaWAN; Sensor Calibration; Signal Conditioning; PCB Design; KiCad; Oscilloscope Operation; Logic Analyzers; JTAG; SWD; Real-time Scheduling; Watchdog Timers; Power Optimization; OTA Firmware Updates; Secure Boot; Hardware-in-the-loop Testing; Software-in-the-loop Testing; ROS 2; Robot Kinematics; SLAM; Path Planning; PID Control; Digital Twin Modeling; OPC UA; Industrial IoT; Edge Inference; Embedded Memory Layout',
  'Demonstrate a sensor-to-dashboard system with fault handling, a simulated device and measured timing',
);

family(
  'business-platforms',
  'development',
  'configure and extend business application platforms',
  'https://trailhead.salesforce.com/',
  'Low-Code/No-Code Developer; WordPress Developer; Shopify Developer; ERP/SAP Developer; Salesforce Developer; ServiceNow Developer; Power Platform Developer; CRM Developer',
  'Business Process Modeling; API Integration; Data Validation; Application Configuration',
  'WordPress; PHP Templates; WordPress Plugin Development; Gutenberg Blocks; WooCommerce; Shopify; Liquid Templates; Shopify Theme Development; Shopify Admin API; Shopify App Development; Salesforce; Apex; Lightning Web Components; SOQL; Salesforce Flow; Salesforce Security Model; Salesforce Deployment; ServiceNow; ServiceNow Scripting; ServiceNow Flow Designer; IT Service Management; SAP ABAP; SAP Fiori; SAP BTP; SAP Integration Suite; SAP S/4HANA; Power Apps; Power Automate; Dataverse; Power Fx; Mendix; OutSystems; Bubble; Webflow; Airtable; Retool; Zapier; Make; n8n; Microsoft Dynamics 365; CRM Data Migration; Workflow Automation; Platform Governance; Low-code Testing; ERP Master Data; CRM Reporting',
  'Implement an approval workflow in a platform sandbox with roles, validation, integration and user documentation',
);

family(
  'blockchain',
  'development',
  'implement verifiable decentralized applications',
  'https://ethereum.org/',
  'Blockchain Developer; Smart Contract Developer (Solidity); Web3 Security Engineer; Blockchain Protocol Engineer',
  'Cryptography Fundamentals; Distributed Systems; Smart Contracts; Blockchain Transactions',
  'Solidity; Ethereum; EVM; Vyper; Foundry; Hardhat; OpenZeppelin; ethers.js; viem; wagmi; Wallet Integration; Gas Optimization; Smart Contract Testing; Smart Contract Auditing; Reentrancy Prevention; ERC-20; ERC-721; ERC-1155; DeFi Protocols; Decentralized Identity; Merkle Trees; Consensus Algorithms; Proof of Stake; Layer 2 Rollups; Zero-knowledge Proofs; Account Abstraction; Multisignature Wallets; On-chain Analytics; IPFS; The Graph; Token Economics; Oracle Integration; Chainlink; Solana; Anchor Framework; Move Language; Blockchain Indexing; Cross-chain Bridges; Blockchain Key Management; Formal Verification of Contracts',
  'Deploy a tested contract to a test network with a threat model and documented transaction costs',
);

family(
  'developer-education',
  'development',
  'help developers understand and adopt technology',
  'https://diataxis.fr/',
  'Technical Writer / Developer Advocate; Developer Relations Engineer; API Documentation Engineer; Developer Educator; Documentation Engineer',
  'Technical Writing; Audience Analysis; Developer Experience; Information Architecture',
  'Docs-as-code; Markdown; reStructuredText; AsciiDoc; Docusaurus; MkDocs; Sphinx; Read the Docs; API Documentation; Tutorials; How-to Guides; Reference Documentation; Conceptual Documentation; Documentation Testing; Code Sample Testing; Style Guides; Plain Language; Documentation Accessibility; Documentation Localization; Documentation Analytics; Content Audits; Developer Onboarding; SDK Examples; Open-source Community Management; Developer Workshops; Conference Speaking; Live Coding; Developer Feedback Research; Documentation Search; Release Notes; Changelogs; Semantic Versioning; RFC Writing; Architecture Decision Records; Technical Editing; Developer Surveys; Community Health Metrics; Contribution Guides; Developer Advocacy Strategy; Sample Application Design',
  'Publish a tested quickstart and API guide, then run a small developer workshop and incorporate feedback',
);

family(
  'applied-ai',
  'ai-ml',
  'build and evaluate language-model applications',
  'https://huggingface.co/learn',
  'AI Engineer; LLM Engineer; Generative AI Developer; Prompt Engineer; AI Agent Developer; RAG Engineer; Conversational AI / Chatbot Developer; AI Automation Specialist; AI Solutions Architect',
  'Python; Machine Learning Fundamentals; Model Evaluation; Responsible AI',
  'Prompt Engineering; In-context Learning; Few-shot Prompting; Structured Generation; Tool Calling; AI Agents; Multi-agent Orchestration; Retrieval-augmented Generation; Embeddings; Vector Search; Hybrid Search; Reranking; Chunking Strategies; Retrieval Evaluation; Grounded Generation; Hallucination Evaluation; Prompt Injection Defense; LLM Guardrails; LLM Observability; LLM Caching; Token Budgeting; Model Routing; LangChain; LlamaIndex; LangGraph; Semantic Kernel; DSPy; Hugging Face Transformers; Sentence Transformers; FAISS; Chroma; Qdrant; Milvus; Weaviate; pgvector; Pinecone; LLM Fine-tuning; LoRA; QLoRA; Instruction Tuning; Preference Optimization; Synthetic Data Generation; Human-in-the-loop AI; Conversation Design; Dialogue State Tracking; Intent Classification; AI Workflow Automation; Agent Evaluation; LLM Cost Optimization; Multimodal Prompting; AI Red Teaming; Model Context Protocol',
  'Build a grounded assistant with cited retrieval, a held-out evaluation set, safety checks and a cost report',
);

family(
  'ml-research',
  'ai-ml',
  'develop and test learning algorithms',
  'https://pytorch.org/tutorials/',
  'Machine Learning Engineer; Deep Learning Engineer; Computer Vision Engineer; NLP Engineer; Speech/Audio AI Engineer; Reinforcement Learning Engineer; Applied Scientist; Research Scientist (AI); Data Scientist',
  'Python; Linear Algebra; Probability; Experimental Design',
  'Supervised Learning; Unsupervised Learning; Regression; Classification; Clustering; Decision Trees; Random Forests; Gradient Boosting; XGBoost; LightGBM; scikit-learn; PyTorch; TensorFlow; JAX; Neural Networks; Backpropagation; Optimization Algorithms; Regularization; Feature Engineering; Cross-validation; Hyperparameter Optimization; Bayesian Optimization; Transformers; Attention Mechanisms; Convolutional Neural Networks; Recurrent Neural Networks; Diffusion Models; Generative Adversarial Networks; Computer Vision; Image Classification; Object Detection; Image Segmentation; Optical Character Recognition; Natural Language Processing; Tokenization; Named Entity Recognition; Text Classification; Speech Recognition; Audio Feature Extraction; Text-to-speech Modeling; Reinforcement Learning; Markov Decision Processes; Policy Gradients; Q-learning; Offline Reinforcement Learning; Causal Machine Learning; Graph Neural Networks; Contrastive Learning; Self-supervised Learning; Multimodal Learning; Research Reproducibility; Ablation Studies; Scientific Literature Review; Model Calibration; Uncertainty Estimation',
  'Reproduce a published baseline on public data, compare alternatives and report uncertainty and limitations',
);

family(
  'ml-operations',
  'ai-ml',
  'operate reliable and governed AI systems',
  'https://mlflow.org/docs/latest/',
  'MLOps Engineer; LLMOps Engineer; AI Product Manager; AI Ethics & Governance Specialist; Responsible AI Analyst; Data Annotation/ML Data Specialist; AI Safety Engineer; Model Validation Analyst',
  'Model Evaluation; Data Quality; Responsible AI; Model Lifecycle Management',
  'MLflow; Kubeflow; KServe; BentoML; Seldon; Model Registries; Feature Stores; Feast; Model Serving; Model Monitoring; Data Drift Detection; Concept Drift Detection; Training Pipelines; Model CI/CD; Model Versioning; Dataset Versioning; DVC; Experiment Tracking; A/B Model Testing; Canary Model Deployment; Shadow Model Deployment; Model Rollback; Model Quantization; Knowledge Distillation; ONNX; TensorRT; TFLite; GPU Scheduling; Distributed Training; Data Labeling; Annotation Guidelines; Inter-annotator Agreement; Label Quality Audits; Active Learning; AI Impact Assessment; Algorithmic Fairness; Bias Measurement; Explainable AI; SHAP; LIME; Model Cards; Datasheets for Datasets; AI Risk Management; AI Governance; AI Product Discovery; AI Success Metrics; AI Procurement; Model Licensing; AI Incident Response; Human Oversight Design; NIST AI RMF; Privacy-preserving ML; Federated Learning; Differential Privacy',
  'Create a versioned model release with monitoring, rollback, annotation checks and a documented risk assessment',
);

family(
  'data-analysis',
  'data',
  'turn data into defensible decisions',
  'https://www.kaggle.com/learn',
  'Data Analyst; BI Analyst; Business Analyst; Product Analyst; Marketing Analyst; Financial Data Analyst; Healthcare Data Analyst; Reporting Analyst; Research Analyst',
  'SQL; Spreadsheets; Statistics; Data Visualization',
  'Data Cleaning; Exploratory Data Analysis; Data Profiling; Missing Data Treatment; Outlier Detection; Descriptive Statistics; Inferential Statistics; Hypothesis Testing; Confidence Intervals; Sampling Methods; Survey Analysis; Cohort Analysis; Funnel Analysis; Retention Analysis; Customer Segmentation; Customer Lifetime Value; Churn Analysis; Attribution Modeling; Marketing Mix Modeling; Product Metrics; North Star Metrics; KPI Design; Business Requirements Analysis; Stakeholder Interviews; Process Mapping; Root Cause Analysis; Data Storytelling; Dashboard Design; Metric Definitions; Pandas; NumPy; R; Tidyverse; dplyr; tidyr; Jupyter; Quarto; Excel; Pivot Tables; Power Query; DAX; Google Sheets; Spreadsheet Formulas; Spreadsheet Data Validation; Financial Data Reconciliation; Clinical Data Analysis; Healthcare Quality Metrics; Data Ethics; Research Methods; A/B Testing; Experiment Analysis; Measurement Planning; Data Presentation',
  'Analyze an open dataset, publish a decision dashboard and explain data limitations to a stakeholder',
);

family(
  'data-engineering',
  'data',
  'build trusted data pipelines and storage',
  'https://spark.apache.org/docs/latest/',
  'Data Engineer; Analytics Engineer; Database Developer; Database Administrator; Big Data Engineer; Data Architect; ETL Developer; Data Platform Engineer',
  'SQL; Data Modeling; Data Quality; Data Pipelines',
  'PostgreSQL; MySQL; SQL Server; Oracle Database; MongoDB; Cassandra; DynamoDB; Elasticsearch; Snowflake; Databricks; BigQuery; Redshift; Apache Spark; PySpark; Apache Hadoop; HDFS; Apache Hive; Apache Kafka; Kafka Streams; Apache Flink; Apache Beam; Apache Airflow; Dagster; Prefect; dbt; ETL; ELT; Change Data Capture; Debezium; Data Warehousing; Data Lakes; Lakehouse Architecture; Delta Lake; Apache Iceberg; Apache Hudi; Apache Parquet; Apache Avro; Dimensional Modeling; Star Schema; Slowly Changing Dimensions; Data Partitioning; Query Optimization; Query Execution Plans; Database Indexing; Database Replication; Database Backup and Recovery; Database Security; Database Migrations; Connection Management; Stream Processing; Batch Processing; Data Contracts; Schema Evolution; Data Lineage; Data Catalogs; Data Orchestration; Medallion Architecture; Data Mesh',
  'Build a reproducible ingestion-to-analytics pipeline with quality checks, lineage and recovery tests',
);

family(
  'data-specialisms',
  'data',
  'communicate, govern and model complex evidence',
  'https://www.openintro.org/',
  'Data Governance Analyst; Data Quality Analyst; Power BI Developer; Tableau Developer; Data Visualization Specialist; Statistician; Quantitative Analyst; Operations Research Analyst; GIS Analyst',
  'Statistics; Data Modeling; Data Visualization; Research Methods',
  'Power BI; Tableau; Looker; Looker Studio; Qlik Sense; Apache Superset; Metabase; Matplotlib; Seaborn; Plotly; ggplot2; D3.js; Vega-Lite; Observable; Geospatial Analysis; QGIS; ArcGIS; GeoJSON; Spatial SQL; PostGIS; Coordinate Reference Systems; Cartographic Design; Statistical Modeling; Bayesian Statistics; Time Series Analysis; Forecasting; Survival Analysis; Multivariate Analysis; Generalized Linear Models; Mixed Effects Models; Causal Inference; Propensity Score Matching; Linear Programming; Integer Programming; Simulation Modeling; Monte Carlo Simulation; Queueing Theory; Optimization Modeling; Data Stewardship; Master Data Management; Metadata Management; Data Retention; Data Classification; Data Quality Rules; Great Expectations; Soda; Data Observability; Data Ownership; Business Glossaries; Statistical Process Control; Data Access Policies; Data Reconciliation',
  'Deliver a reproducible analytical model and an accessible evidence report with governance and quality checks',
);

family(
  'cloud-platforms',
  'infrastructure',
  'operate scalable cloud infrastructure',
  'https://learn.microsoft.com/training/',
  'Cloud Engineer; Cloud Architect; AWS Engineer; Azure Engineer; GCP Engineer; Cloud Support Engineer; Solutions Architect; Cloud Migration Engineer',
  'Cloud Computing; Networking; Linux; Identity and Access Management',
  'AWS; Microsoft Azure; Google Cloud; AWS EC2; AWS S3; AWS Lambda; AWS VPC; AWS IAM; AWS RDS; AWS CloudFormation; AWS CloudWatch; AWS ECS; AWS EKS; AWS Route 53; AWS CloudFront; AWS Organizations; Azure Virtual Machines; Azure Storage; Azure Functions; Azure Virtual Network; Azure Entra ID; Azure SQL; Azure Monitor; Azure App Service; Azure AKS; Azure Resource Manager; Azure Bicep; GCP Compute Engine; Google Cloud Storage; Google Cloud Run; GCP Cloud Functions; GCP VPC; GCP IAM; GCP Cloud SQL; GCP GKE; GCP Cloud Monitoring; Cloud Networking; Cloud Migration; Cloud Landing Zones; Cloud Disaster Recovery; Multi-cloud Architecture; Cloud Capacity Planning; Cloud Cost Allocation; Cloud Tagging; Cloud Service Quotas; Shared Responsibility Model; Cloud Resilience; Cloud Well-Architected Reviews; Serverless Architecture; Cloud Data Transfer; Cloud Backup; Cloud Infrastructure Security; AWS Solutions Architect Certification; Azure Administrator Certification; Google Cloud Associate Cloud Engineer',
  'Provision a secure cloud workload with infrastructure code, recovery procedures and a cost estimate',
);

family(
  'delivery-platforms',
  'infrastructure',
  'automate safe and reliable software delivery',
  'https://kubernetes.io/docs/',
  'DevOps Engineer; Platform Engineer; Site Reliability Engineer (SRE); Kubernetes/Container Engineer; Infrastructure as Code Engineer; Release/Build Engineer; Observability Engineer; FinOps Practitioner',
  'Linux; Git; CI/CD; Infrastructure as Code',
  'Docker; Kubernetes; Terraform; Ansible; Pulumi; OpenTofu; Packer; Vagrant; Helm; Kustomize; Argo CD; Flux; Jenkins; GitHub Actions; GitLab CI; CircleCI; Buildkite; Tekton; Container Registries; Container Image Hardening; Kubernetes Networking; Kubernetes RBAC; Kubernetes Storage; Kubernetes Operators; Kubernetes Autoscaling; Service Mesh; Istio; Linkerd; Prometheus; Grafana; OpenTelemetry; Jaeger; Zipkin; Loki; Elastic Stack; Datadog; Distributed Tracing; Service Level Indicators; Service Level Objectives; Error Budgets; Incident Management; Postmortems; Chaos Engineering; GitOps; Blue-green Deployment; Canary Releases; Deployment Rollbacks; Build Reproducibility; Software Bill of Materials; Artifact Management; FinOps; Reserved Capacity Planning; Cloud Cost Forecasting; Unit Economics; Kubernetes CKA Certification; Kubernetes CKAD Certification; Terraform Associate Certification',
  'Create a repeatable delivery platform with service objectives, telemetry and a tested rollback runbook',
);

family(
  'it-operations',
  'infrastructure',
  'maintain dependable networks and user systems',
  'https://learn.microsoft.com/',
  'Linux Administrator; Systems Administrator; Network Engineer; Network Security Engineer; Virtualization Engineer; Storage/Backup Administrator; IT Support Engineer; Help Desk / Technical Support Specialist',
  'Networking; Troubleshooting; Linux; Technical Support',
  'Bash; PowerShell; Windows Server; Active Directory; Group Policy; DNS; DHCP; TCP/IP; Routing; Switching; VLANs; VPN; BGP; OSPF; IPv6; Network Address Translation; Firewalls; Wi-Fi Administration; Network Monitoring; Wireshark; tcpdump; SNMP; Network Automation; Cisco IOS; Juniper Junos; VMware vSphere; Hyper-V; KVM; Proxmox; Virtual Machine Migration; SAN; NAS; RAID; Storage Provisioning; Backup Strategy; Recovery Point Objectives; Recovery Time Objectives; Disaster Recovery Testing; Patch Management; Endpoint Management; Microsoft Intune; SCCM; Remote Desktop Support; Ticket Triage; Service Desk Knowledge Bases; IT Asset Management; ITIL; Print Services; Email Administration; Microsoft 365 Administration; Google Workspace Administration; Hardware Diagnostics; CCNA Certification; CompTIA A+ Certification; CompTIA Network+ Certification',
  'Build a small network lab, resolve simulated incidents and verify backup restoration with a runbook',
);

family(
  'security-operations',
  'cybersecurity',
  'detect, investigate and respond to security threats',
  'https://www.cisa.gov/',
  'Security Analyst (SOC); Cybersecurity Engineer; Threat Intelligence Analyst; Incident Responder; Digital Forensics Analyst; Malware Analyst; Vulnerability Management Analyst; Detection Engineer',
  'Security Fundamentals; Networking; Threat Modeling; Incident Response',
  'SIEM; SOAR; Splunk; Microsoft Sentinel; Elastic Security; Security Onion; Wazuh; Log Analysis; Threat Hunting; MITRE ATT&CK; Sigma Rules; YARA Rules; Detection Engineering; Endpoint Detection and Response; Network Detection and Response; Indicators of Compromise; Threat Intelligence; OSINT; Intelligence Analysis; Incident Triage; Incident Containment; Incident Eradication; Incident Recovery; Digital Forensics; Disk Imaging; Memory Forensics; Volatility; Autopsy; Chain of Custody; Malware Analysis; Static Malware Analysis; Dynamic Malware Analysis; Ghidra; IDA Free; Reverse Engineering; Sandboxing; Packet Analysis; Vulnerability Scanning; Nessus; OpenVAS; CVSS; Vulnerability Prioritization; Patch Verification; Security Playbooks; Phishing Analysis; Email Security; Ransomware Response; Security Metrics; CompTIA Security+ Certification; GIAC Certification Preparation',
  'Investigate a synthetic incident in an isolated lab and produce a defensible timeline and response report',
);

family(
  'security-engineering',
  'cybersecurity',
  'design and verify secure systems',
  'https://owasp.org/',
  'Penetration Tester; Ethical Hacker; Application Security Engineer; Cloud Security Engineer; DevSecOps Engineer; Security Architect; Identity & Access Management Specialist; Security Tester',
  'Security Fundamentals; Threat Modeling; Secure Coding; Security Testing',
  'OWASP Top 10; OWASP ASVS; OWASP WSTG; Burp Suite; OWASP ZAP; Nmap; Metasploit; Web Penetration Testing; API Security Testing; Mobile Security Testing; Authorization Testing; SQL Injection Prevention; Cross-site Scripting Prevention; CSRF Prevention; Server-side Request Forgery Prevention; Secure Authentication; SAST; DAST; Software Composition Analysis; Secret Scanning; Dependency Security; Container Security; Kubernetes Security; Cloud Security Posture Management; Infrastructure Security Scanning; Policy as Code; Open Policy Agent; Key Management; Secrets Management; HashiCorp Vault; Public Key Infrastructure; TLS; Certificate Management; Zero Trust; Privileged Access Management; SAML; OpenID Connect; SCIM; Role-based Access Control; Attribute-based Access Control; Access Reviews; Identity Governance; Security Architecture Reviews; Secure Design Patterns; Cryptographic Protocols; Network Segmentation; Attack Surface Management; Penetration Test Reporting; CEH Certification; CISSP Certification',
  'Assess an intentionally vulnerable lab with written authorization, fix findings and verify the controls',
);

family(
  'governance',
  'cybersecurity',
  'translate risk and privacy obligations into controls',
  'https://www.nist.gov/',
  'GRC / Compliance Analyst; Privacy / Data Protection Officer; Security Compliance Manager; Third-party Risk Analyst; Technology Risk Analyst; Privacy Engineer',
  'Risk Assessment; Policy Writing; Control Testing; Privacy Principles',
  'Governance Risk and Compliance; NIST Cybersecurity Framework; ISO 27001; ISO 27002; SOC 2; Control Mapping; Risk Registers; Risk Treatment; Security Policies; Business Continuity Planning; Business Impact Analysis; Audit Evidence; Audit Readiness; Third-party Risk Management; Vendor Security Assessment; Security Questionnaires; Data Protection Impact Assessment; Privacy by Design; Data Minimization; Consent Management; Data Subject Rights; Records of Processing; Data Transfer Assessment; Privacy Notices; Data Discovery; Data Loss Prevention; Retention Schedules; Privacy Threat Modeling; Pseudonymization; Anonymization; Security Awareness Training; Compliance Monitoring; Regulatory Change Management; Exception Management; Risk Reporting; Board Risk Communication; Information Security Management Systems; Security Control Design; Privacy Engineering; CISA Certification; CISM Certification; CRISC Certification; ISO 27001 Auditor Preparation',
  'Produce a risk register, control evidence pack and privacy assessment for a fictional service',
);

family(
  'quality-testing',
  'quality',
  'evaluate software behavior and release quality',
  'https://playwright.dev/',
  'QA Engineer; Test Automation Engineer; SDET; Manual Tester; Performance Test Engineer; Mobile Test Engineer; API Test Engineer; QA Lead / Manager; Web Accessibility Specialist; Game QA Tester; Release Quality Analyst',
  'Testing; Test Design; Defect Reporting; Quality Assurance',
  'Playwright; Selenium; Cypress; WebdriverIO; Robot Framework; Cucumber; Gherkin; Behavior-driven Development; Test-driven Development; Exploratory Testing; Regression Testing; Smoke Testing; Acceptance Testing; Boundary Value Analysis; Equivalence Partitioning; Decision Table Testing; Pairwise Testing; State Transition Testing; Risk-based Testing; Test Planning; Test Data Management; Test Environment Management; Test Coverage Analysis; Test Reporting; Flaky Test Diagnosis; Mocking; Service Virtualization; Postman; REST Assured; Pact; JMeter; k6; Gatling; Locust; Load Testing; Stress Testing; Soak Testing; Performance Bottleneck Analysis; axe-core; WCAG; Screen Reader Testing; Keyboard Navigation Testing; NVDA; JAWS; VoiceOver; Game Compatibility Testing; Localization Testing; Release Readiness Reviews; Quality Metrics; Test Management; ISTQB Foundation Certification',
  'Deliver a risk-based test plan, automated regression suite and evidence-based release recommendation',
);

family(
  'experience-design',
  'design',
  'research and design useful experiences',
  'https://www.nngroup.com/',
  'Product Designer; UI Designer; UX Designer; UX Researcher; Interaction Designer; Design Systems Designer; Content Designer / UX Writer; Service Designer; Information Architect',
  'User Research; Wireframing; Prototyping; Usability Testing',
  'Figma; Sketch; Adobe XD; FigJam; Miro; Design Thinking; Double Diamond; User Interviews; Contextual Inquiry; Diary Studies; Card Sorting; Tree Testing; Heuristic Evaluation; User Personas; Jobs to Be Done; Journey Mapping; Service Blueprints; Affinity Mapping; Research Synthesis; Research Recruitment; Research Consent; Research Repositories; Interaction Design; UI Design; Visual Hierarchy; Layout Design; Responsive Prototyping; Design Systems; Design Tokens; Component Libraries; Design Documentation; Inclusive Design; Accessible Design; UX Writing; Microcopy; Content Design; Content Modeling; Error Message Design; Navigation Design; Form Design; Onboarding Design; Design Critique; Design Handoff; Design QA; Product Discovery Research; Quantitative UX Research; Mixed Methods Research; Usability Metrics; SUS; Research Operations; UX Strategy; Design Facilitation',
  'Research a real task, prototype an improved experience and document usability findings and iterations',
);

family(
  'visual-design',
  'design',
  'communicate ideas through visual systems',
  'https://www.adobe.com/learn',
  'Visual Designer; Graphic Designer; Brand Designer; Motion Designer; 3D Designer; Industrial/Product Designer; Packaging Designer; Typographer; Illustrator; Creative Director; Presentation Designer',
  'Composition; Color Theory; Typography; Visual Communication',
  'Adobe Photoshop; Adobe Illustrator; Adobe InDesign; Affinity Designer; Affinity Publisher; Canva; Brand Strategy; Brand Identity; Logo Design; Brand Guidelines; Art Direction; Creative Briefs; Grid Systems; Editorial Design; Print Production; Prepress; Color Management; CMYK Workflows; RGB Workflows; Vector Illustration; Icon Design; Infographics; Presentation Design; Data-driven Slides; Slide Master Design; Storyboarding; Motion Design; Adobe After Effects; Cinema 4D; Blender; 3D Modeling; Product Rendering; CAD; Fusion 360; SolidWorks; Industrial Design; Ergonomics; Design for Manufacturing; Packaging Dielines; Packaging Materials; Sustainable Packaging; Typeface Design; Font Licensing; Lettering; Illustration; Digital Painting; Concept Sketching; Visual Storytelling; Design Portfolio Curation; Creative Project Management; Client Design Presentations; Print Accessibility',
  'Create a coherent visual identity and presentation system with production-ready assets and rationale',
);

family(
  'product-leadership',
  'product-management',
  'align product decisions with user and business outcomes',
  'https://www.atlassian.com/agile',
  'Product Manager; Technical Product Manager; Associate Product Manager; Product Owner; Product Operations Manager; Business Systems Analyst; Requirements Analyst; Solutions Consultant; Implementation Consultant',
  'Product Discovery; Stakeholder Management; Requirements Analysis; Prioritization',
  'Product Strategy; Product Vision; Product Roadmapping; Opportunity Assessment; Problem Framing; Customer Discovery; Product-market Fit; Value Propositions; Competitive Analysis; Market Sizing; User Stories; Acceptance Criteria; Backlog Management; RICE Prioritization; MoSCoW Prioritization; Kano Model; Opportunity Solution Trees; Outcome-based Planning; OKRs; Product Analytics; Feature Adoption; Product Experimentation; Pricing Strategy; Go-to-market Planning; Product Launches; Release Communication; Product Documentation; Technical Feasibility Assessment; API Product Management; Platform Product Management; Product Operations; Feedback Management; Customer Advisory Boards; Business Case Development; Benefits Realization; Requirements Traceability; Use Case Modeling; UML; BPMN; Systems Analysis; Solution Consulting; Implementation Planning; User Acceptance Coordination; Product Enablement; Product Feedback Loops; Roadmap Communication; Product Decision Logs; Discovery Interviewing',
  'Present a researched product opportunity, prioritized roadmap and measurable launch experiment',
);

family(
  'delivery-leadership',
  'product-management',
  'coordinate teams and deliver accountable outcomes',
  'https://scrumguides.org/',
  'Scrum Master; Agile Coach; Project Manager; Program Manager; Delivery Manager; Engineering Manager; Technical Program Manager; Customer Success Manager; Portfolio Delivery Manager',
  'Communication; Leadership; Stakeholder Management; Project Planning',
  'Agile; Scrum; Kanban; Lean Delivery; Sprint Planning; Sprint Reviews; Retrospectives; Daily Facilitation; Flow Metrics; Work in Progress Limits; Dependency Management; Program Governance; Project Scheduling; Work Breakdown Structures; Critical Path Method; Resource Planning; Project Budgeting; Project Risk Management; Issue Management; Change Control; Project Status Reporting; Jira; Confluence; Asana; Trello; Microsoft Project; Smartsheet; Team Coaching; Conflict Resolution; Negotiation; Facilitation; Decision Making; Engineering Hiring; Performance Feedback; Career Development; Mentoring; Psychological Safety; Technical Debt Management; Engineering Metrics; Team Capacity Planning; Customer Success Planning; Customer Health Scores; Customer Onboarding; Renewal Planning; Executive Business Reviews; Escalation Management; PMP Certification; Certified ScrumMaster Certification; PRINCE2 Foundation Preparation; Program Benefits Management; Stakeholder Mapping; Delivery Forecasting',
  'Create and run a delivery plan with a risk log, team cadence, stakeholder review and outcome measures',
);

family(
  'corporate-finance',
  'finance',
  'analyze financial performance and allocate capital',
  'https://www.corporatefinanceinstitute.com/resources/',
  'Financial Analyst; Corporate Finance Associate; FP&A Analyst; Financial Modeler; Treasury Analyst; Cost Accountant; Finance Business Partner',
  'Financial Accounting; Financial Modeling; Budgeting; Financial Analysis',
  'Three-statement Modeling; Income Statement Analysis; Balance Sheet Analysis; Cash Flow Analysis; Budget Forecasting; Rolling Forecasts; Variance Analysis; Scenario Analysis; Sensitivity Analysis; Capital Budgeting; Net Present Value; Internal Rate of Return; Weighted Average Cost of Capital; Working Capital Management; Cash Forecasting; Treasury Management; Liquidity Management; Debt Financing; Capital Structure; Cost Accounting; Activity-based Costing; Standard Costing; Break-even Analysis; Unit Cost Analysis; Contribution Margin Analysis; Management Accounting; Financial Planning; Business Performance Reporting; Board Financial Reporting; Revenue Forecasting; Expense Forecasting; Headcount Planning; CAPEX Planning; Financial Consolidation; Intercompany Accounting; Anaplan; Oracle Hyperion; SAP Analytics Cloud; Adaptive Planning; Excel Financial Modeling; Financial Model Auditing; Financial Controls; Cost Allocation; Driver-based Planning; Covenant Monitoring; Cash Pooling; Hedging Fundamentals; Financial Ratio Analysis',
  'Build an auditable budget and cash-flow model from synthetic statements, with scenarios and an investment memo',
);

family(
  'investments',
  'finance',
  'evaluate investments and communicate portfolio decisions',
  'https://www.cfainstitute.org/',
  'Investment Analyst; Equity Research Analyst; Investment Banking Analyst; Portfolio Manager; Wealth Manager/Financial Planner; Trading Analyst; Mergers & Acquisitions Analyst; Venture Capital Analyst',
  'Financial Analysis; Valuation; Investment Research; Risk Management',
  'Discounted Cash Flow Valuation; Comparable Company Analysis; Precedent Transactions; Enterprise Value; Equity Value; Free Cash Flow; Terminal Value; Equity Research; Investment Thesis Writing; Industry Analysis; Securities Analysis; Portfolio Theory; Asset Allocation; Portfolio Construction; Portfolio Rebalancing; Performance Attribution; Benchmark Selection; Fixed Income; Bond Valuation; Duration and Convexity; Yield Curves; Derivatives; Options Pricing; Futures; Swaps; Market Microstructure; Algorithmic Trading; Trading Execution; Backtesting; Bloomberg Terminal; Refinitiv Eikon; Morningstar; Deal Screening; Due Diligence; M&A Modeling; Accretion Dilution Analysis; Leveraged Buyout Modeling; Venture Capital Modeling; Startup Valuation; Cap Tables; Term Sheet Analysis; Fund Economics; Investment Committee Memos; Financial Planning; Retirement Planning; Investor Suitability; Behavioral Finance; CFA Certification Preparation; Private Equity Analysis; Investment Reporting; Responsible Investing',
  'Prepare a valuation model and investment committee memo using public historical data and explicit risk scenarios',
);

family(
  'accounting',
  'finance',
  'maintain accurate and auditable financial records',
  'https://www.ifrs.org/',
  'Accountant; Chartered Accountant (CA) track; Auditor; Tax Analyst/Consultant; Bookkeeper; Payroll Specialist; Forensic Accountant; Accounting Systems Analyst',
  'Financial Accounting; Bookkeeping; Account Reconciliation; Internal Controls',
  'Double-entry Accounting; General Ledger; Trial Balance; Journal Entries; Accounts Payable; Accounts Receivable; Bank Reconciliation; Month-end Close; Year-end Close; Revenue Recognition; Lease Accounting; Inventory Accounting; Fixed Asset Accounting; Depreciation; Accrual Accounting; IFRS; US GAAP; Consolidation Accounting; Financial Statement Preparation; Audit Planning; Audit Sampling; Substantive Testing; Audit Working Papers; Internal Audit; External Audit; Fraud Investigation; Forensic Accounting; Tax Research; Corporate Tax Fundamentals; Indirect Tax Fundamentals; Transfer Pricing Fundamentals; Deferred Tax; Tax Reconciliation; Payroll Processing; Payroll Reconciliation; Employee Expense Controls; QuickBooks; Xero; Tally; SAP FICO; Oracle Financials; NetSuite; Accounting Automation; Document Retention; Segregation of Duties; CPA Certification Preparation; ACCA Certification Preparation; Chartered Accountancy Preparation; Audit Analytics; Financial Reporting Controls',
  'Close a synthetic ledger, reconcile balances and prepare a financial statement and audit evidence pack',
);

family(
  'financial-risk',
  'finance',
  'measure financial uncertainty and regulatory exposure',
  'https://www.garp.org/',
  'Credit Analyst; Risk Analyst; Quantitative Risk Analyst; Actuary; Compliance Officer (Finance); AML/KYC Analyst; ESG Analyst; Insurance Underwriter; Fintech Product Analyst',
  'Risk Management; Statistics; Financial Analysis; Regulatory Research',
  'Credit Risk; Market Risk; Operational Risk; Liquidity Risk; Counterparty Risk; Credit Scoring; Credit Underwriting; Financial Covenant Analysis; Probability of Default; Loss Given Default; Exposure at Default; Expected Credit Loss; Value at Risk; Expected Shortfall; Stress Testing; Risk Limit Monitoring; Risk-adjusted Returns; Basel Framework Fundamentals; Capital Adequacy; Asset Liability Management; Model Risk Management; Risk Model Validation; Actuarial Mathematics; Loss Reserving; Insurance Pricing; Claims Analysis; Underwriting Analysis; Reinsurance Fundamentals; Solvency Modeling; Financial Compliance; AML; KYC; Customer Due Diligence; Enhanced Due Diligence; Transaction Monitoring; Sanctions Screening; Suspicious Activity Investigation; Financial Crime Risk; ESG Analysis; Climate Financial Risk; Sustainability Reporting; Materiality Assessment; Fintech Business Models; Payment Systems; Open Banking; Fraud Analytics; FRM Certification Preparation; Actuarial Exam Preparation; Compliance Testing; Regulatory Reporting; Financial Consumer Protection',
  'Create a synthetic risk assessment with a validated model, control tests and a concise oversight report',
);

family(
  'digital-marketing',
  'business',
  'measure and improve customer acquisition',
  'https://skillshop.withgoogle.com/',
  'Digital Marketing Specialist; SEO Specialist; SEM/PPC Specialist; Growth Marketer; Performance Marketer; Marketing Automation Specialist; E-commerce Manager; Marketing Analytics Manager',
  'Marketing Strategy; Marketing Analytics; Customer Segmentation; Experimentation',
  'SEO; Technical SEO; On-page SEO; Off-page SEO; Keyword Research; Search Intent Analysis; Link Building; SEO Audits; Google Search Console; Google Analytics 4; Google Tag Manager; Search Engine Marketing; Google Ads; Microsoft Advertising; Meta Ads; LinkedIn Ads; TikTok Ads; PPC Campaign Management; Bid Optimization; Conversion Tracking; Conversion Rate Optimization; Landing Page Optimization; Funnel Optimization; Growth Experiments; Acquisition Strategy; Activation Metrics; Referral Programs; Retention Marketing; Lifecycle Marketing; Marketing Attribution; Incrementality Testing; ROAS Analysis; CAC Analysis; Marketing Budget Allocation; Campaign Reporting; Marketing Automation; HubSpot; Marketo; Salesforce Marketing Cloud; Klaviyo; Customer Data Platforms; Segment; E-commerce Analytics; Merchandising; Product Feed Management; Google Merchant Center; A/B Landing Page Testing; Programmatic Advertising; Display Advertising; Affiliate Marketing; Google Analytics Certification',
  'Design and measure a small acquisition campaign with a landing page, tracking plan and experiment readout',
);

family(
  'brand-content',
  'business',
  'build coherent audience and brand communication',
  'https://academy.hubspot.com/',
  'Social Media Manager; Content Strategist; Content Marketer; Email Marketing Specialist; Brand Manager; Influencer Marketing Manager; Public Relations Specialist; Market Research Analyst',
  'Content Strategy; Audience Research; Brand Positioning; Communication',
  'Social Media Strategy; Social Listening; Community Engagement; Editorial Calendars; Content Planning; Content Distribution; Content Auditing; Content Repurposing; Brand Voice; Messaging Frameworks; Brand Architecture; Brand Research; Brand Tracking; Brand Campaigns; Consumer Insights; Qualitative Market Research; Quantitative Market Research; Survey Design; Focus Groups; Competitor Research; Market Segmentation; Positioning Research; Email Marketing; Email Copywriting; Email Deliverability; Email List Hygiene; Email Segmentation; Email Automation; Newsletter Strategy; Influencer Discovery; Influencer Partnerships; Creator Briefs; Influencer Campaign Measurement; Public Relations; Media Relations; Press Releases; Media Pitches; Crisis Communication; Reputation Management; Corporate Communication; Internal Communication; Communications Measurement; Integrated Marketing Communication; Campaign Briefing; Sponsorship Strategy; Community Guidelines; Content Accessibility; Brand Safety; UTM Governance; Social Media Reporting',
  'Produce a researched audience strategy and coordinated content campaign with a measurement framework',
);

family(
  'sales-success',
  'business',
  'understand customer needs and grow accountable relationships',
  'https://trailhead.salesforce.com/',
  'Sales Development Rep; Account Executive; Sales Engineer; Business Development Manager; Customer Support Specialist; Community Manager; Revenue Operations Analyst; Partnerships Manager',
  'Communication; Customer Discovery; Relationship Management; CRM',
  'Prospecting; Lead Qualification; Account Research; Cold Outreach; Sales Discovery; Consultative Selling; Solution Selling; Sales Demonstrations; Technical Demonstrations; Proof of Concept Planning; Objection Handling; Sales Negotiation; Pipeline Management; Opportunity Management; Sales Forecasting; Account Planning; Territory Planning; Sales Proposals; RFP Responses; Contract Negotiation; Partner Enablement; Channel Sales; Partnership Strategy; Revenue Operations; Sales Operations; Salesforce Administration; HubSpot CRM; Pipedrive; Zendesk; Intercom; Freshdesk; Support Ticket Management; Customer Empathy; De-escalation; Knowledge Base Writing; Support Quality Assurance; Customer Satisfaction Measurement; Net Promoter Score; Community Moderation; Community Programming; Online Event Hosting; Community Analytics; Customer Advocacy; Customer Education; Support Automation; Service Level Management; Customer Feedback Analysis; Sales Enablement; Lead Scoring; Revenue Funnel Analysis',
  'Run a simulated customer engagement from discovery to solution demo, handover and success measurement',
);

family(
  'operations-strategy',
  'business',
  'improve business systems and operational decisions',
  'https://openstax.org/subjects/business',
  'Operations Manager; Supply Chain Analyst; Procurement Specialist; Management Consultant; Strategy Analyst; Entrepreneur / Startup Founder track; Business Operations Analyst; Logistics Coordinator',
  'Problem Solving; Business Analysis; Process Improvement; Stakeholder Management',
  'Operations Strategy; Operating Models; Standard Operating Procedures; Process Optimization; Lean Six Sigma; Value Stream Mapping; Bottleneck Analysis; Capacity Planning; Demand Planning; Inventory Management; Safety Stock; Economic Order Quantity; Supply Chain Management; Supply Chain Forecasting; Logistics Planning; Warehouse Operations; Transportation Planning; Procurement; Strategic Sourcing; Supplier Evaluation; Supplier Relationship Management; Purchase Order Management; Contract Management; Total Cost of Ownership; Spend Analysis; Category Management; Business Strategy; Strategic Planning; SWOT Analysis; PESTLE Analysis; Five Forces Analysis; Business Model Canvas; Unit Economics Modeling; Startup Customer Validation; MVP Scoping; Fundraising Preparation; Pitch Decks; Strategic Partnerships; Management Consulting; Hypothesis-driven Problem Solving; Issue Trees; Executive Presentations; Business Process Automation; KPI Reporting; Change Management; Organizational Design; Business Continuity; Lean Startup; Service Operations; Process Mining; Sustainability Operations',
  'Diagnose an operational bottleneck, compare options and present an implementable improvement plan',
);

family(
  'people-learning',
  'business',
  'support effective and fair people development',
  'https://www.cipd.org/',
  'HR Generalist; Technical Recruiter; Talent Acquisition Specialist; Learning & Development Specialist; People Analytics Analyst; Corporate Trainer; People Operations Specialist',
  'Communication; Interviewing; Facilitation; People Management',
  'Recruitment Planning; Job Analysis; Job Description Writing; Candidate Sourcing; Boolean Talent Search; Technical Screening; Structured Interviews; Interview Scorecards; Candidate Experience; Applicant Tracking Systems; Workday; Greenhouse; Lever; Recruitment Analytics; Offer Management; Employee Onboarding; Employee Relations; HR Policies; HRIS Administration; Benefits Administration; Compensation Benchmarking; Job Evaluation; Performance Management; Engagement Surveys; Employee Experience; Workforce Planning; People Analytics; Attrition Analysis; Headcount Analytics; Pay Equity Analysis; Learning Needs Analysis; Learning Program Design; Adult Learning; Training Facilitation; Training Evaluation; Kirkpatrick Model; Coaching; Leadership Development; Succession Planning; Learning Management Systems; Moodle; TalentLMS; Skills Assessment; Competency Frameworks; Learning Accessibility; Remote Facilitation; Knowledge Management; Inclusive Hiring; Organizational Learning; Employee Listening',
  'Design an evidence-based hiring or learning program with fair assessment and measurable outcomes',
);

family(
  'video-production',
  'creative',
  'produce coherent visual stories',
  'https://www.blackmagicdesign.com/products/davinciresolve/training',
  'Video Editor; Videographer; Cinematographer; Motion Graphics Artist; VFX Artist; Architectural Visualizer; Video Producer',
  'Storytelling; Composition; Storyboarding; Video Production',
  'DaVinci Resolve; Adobe Premiere Pro; Final Cut Pro; Avid Media Composer; Nonlinear Editing; Video Ingest; Media Organization; Proxy Workflows; Editing Rhythm; Continuity Editing; Multicam Editing; Documentary Editing; Video Color Correction; Color Grading; LUT Management; HDR Workflows; Video Scopes; Camera Operation; Camera Exposure; Lens Selection; Camera Movement; Lighting Design; Three-point Lighting; Location Sound Recording; Green Screen Production; Chroma Keying; Rotoscoping; Motion Tracking; Camera Tracking; VFX Compositing; Nuke; Fusion Compositing; After Effects Expressions; Motion Graphics; Title Design; Kinetic Typography; Video Encoding; Video Delivery Formats; Broadcast Standards; Captions and Subtitles; Accessible Video Production; Architectural Rendering; Unreal Archviz; V-Ray; Corona Renderer; Virtual Production; Shot Planning; Production Scheduling; Video Rights Management; Stock Footage Licensing',
  'Produce a short visual story with a shot plan, graded edit, accessible captions and a production breakdown',
);

family(
  'animation-art',
  'creative',
  'create expressive animation and game assets',
  'https://docs.blender.org/manual/en/latest/',
  'Animator (2D); Animator (3D); Concept Artist; Digital Artist/Illustrator; Game Artist; Character Designer; Technical Artist; Art Director',
  'Drawing Fundamentals; Anatomy for Artists; Perspective Drawing; Art Direction',
  'Animation Principles; 2D Animation; 3D Animation; Character Animation; Keyframe Animation; Tweening; Walk Cycles; Acting for Animation; Lip Sync; Facial Animation; Rigging; Character Rigging; Skinning; Inverse Kinematics; Motion Capture Cleanup; Blender Animation; Autodesk Maya; Autodesk 3ds Max; Toon Boom Harmony; TVPaint; Adobe Animate; Spine Animation; DragonBones; Stop Motion; Concept Art; Character Design; Environment Design; Creature Design; Prop Design; Silhouette Design; Gesture Drawing; Color Scripts; Texture Painting; UV Mapping; PBR Materials; Substance Painter; Substance Designer; ZBrush; Digital Sculpting; Retopology; Procedural Modeling; Houdini; Particle Effects; Game Asset Optimization; Technical Art; Asset Pipelines; Material Authoring; Lighting for Games; Art Style Guides; Portfolio Art Direction',
  'Create a coherent animated scene or game asset pack with process studies and technical breakdowns',
);

family(
  'photography-spaces',
  'creative',
  'develop intentional images and spatial design',
  'https://www.adobe.com/learn',
  'Photographer; Photo Retoucher; Fashion Designer; Interior Designer; Creative Technologist; Product Photographer',
  'Composition; Color Theory; Creative Research; Client Briefing',
  'Photography; Exposure Triangle; Manual Camera Control; Portrait Photography; Product Photography; Architectural Photography; Event Photography; Documentary Photography; Studio Lighting; Natural Light Photography; Flash Photography; Light Metering; Photo Composition; Photo Editing; Adobe Lightroom; Capture One; RAW Processing; Photo Retouching; Frequency Separation; Dodge and Burn; Photo Color Correction; Image Masking; Digital Asset Management; Photo Metadata; Model Releases; Image Licensing; Fashion Illustration; Fashion Research; Textile Knowledge; Pattern Making; Garment Construction; Draping; CLO 3D; Fashion Collection Development; Sustainable Fashion; Interior Space Planning; Interior Materials; Furniture Specification; Interior Lighting; AutoCAD; SketchUp; Revit; Building Information Modeling; Material Boards; Interior Visualization; Spatial Storytelling; Interactive Installations; Creative Coding; TouchDesigner; Processing; p5.js; Projection Mapping',
  'Develop a cohesive client portfolio with research, production studies and clear usage or material specifications',
);

family(
  'audio-production',
  'creative',
  'record and shape clear expressive audio',
  'https://learningmusic.ableton.com/',
  'Sound Designer; Audio Engineer; Music Producer; Podcast Producer; Voice-Over Artist; Live Sound Engineer',
  'Critical Listening; Audio Signal Flow; Recording Techniques; Audio Editing',
  'Digital Audio Workstations; Ableton Live; Logic Pro; Pro Tools; Reaper; FL Studio; Audacity; Microphone Techniques; Microphone Selection; Gain Staging; Audio Interfaces; Sample Rates; Bit Depth; Audio Latency; Equalization; Audio Compression; Limiting; Reverb; Delay Effects; Noise Reduction; De-essing; Dialogue Editing; Sound Effects Editing; Foley Recording; Field Recording; Sound Synthesis; Subtractive Synthesis; FM Synthesis; Sampling; MIDI; Music Theory; Harmony; Rhythm Programming; Music Arrangement; Mixing; Mastering; Loudness Standards; LUFS Metering; Spatial Audio; Ambisonics; Dolby Atmos Fundamentals; Game Audio; FMOD; Wwise; Podcast Editing; Podcast Distribution; RSS Feeds for Podcasts; Voice Direction; Vocal Performance; Audiobook Production; Live Sound Reinforcement; Monitor Mixing; Audio Rights Management',
  'Produce and master a short audio story or soundscape with intelligibility checks and delivery specifications',
);

family(
  'writing-media',
  'creative',
  'research and publish accurate engaging content',
  'https://www.poynter.org/',
  'Copywriter; Content Writer; Technical Writer; Scriptwriter; Journalist/Digital Journalist; Editor/Proofreader; UGC Creator / Content Creator; Streamer/Community Manager; Translator/Localization Specialist',
  'Writing; Research; Editing; Storytelling',
  'Copywriting; Persuasive Writing; Long-form Writing; Web Writing; Feature Writing; News Writing; Interview Techniques; Fact Checking; Source Verification; Media Ethics; Investigative Research; Data Journalism; Mobile Journalism; Newsletter Writing; Headline Writing; Scriptwriting; Screenplay Structure; Dialogue Writing; Script Coverage; Story Development; Narrative Structure; Character Development; Developmental Editing; Copy Editing; Proofreading; Style Sheet Creation; Editorial Judgment; Publication Planning; Content Management Systems; WordPress Publishing; Search-friendly Writing; Accessible Writing; Creator Content Planning; Short-form Video Scripting; On-camera Presentation; Livestream Production; OBS Studio; Streamlabs; Audience Engagement; Creator Analytics; Creator Monetization; Translation; Localization; Transcreation; Terminology Management; Translation Memory; CAT Tools; Trados; memoQ; Subtitle Translation; Localization QA; Cultural Adaptation; Editorial Project Management',
  'Publish a researched multimedia story with verified sources, editorial revisions and audience feedback',
);

family(
  'science-health',
  'other',
  'apply computation and evidence in specialist domains',
  'https://www.ncbi.nlm.nih.gov/',
  'Healthcare Informatics Specialist; Bioinformatics Analyst; Clinical Informatics Analyst; Computational Biologist; Health Data Engineer',
  'Research Methods; Statistics; Data Ethics; Scientific Communication',
  'Healthcare Informatics; Electronic Health Records; Clinical Workflows; Health Information Exchange; HL7; FHIR; DICOM; Clinical Terminologies; SNOMED CT; LOINC; ICD Coding Fundamentals; Clinical Decision Support; Healthcare Interoperability; Health Data Quality; Patient Safety Informatics; Clinical Data Standards; Clinical Study Design; Epidemiology; Public Health Surveillance; Bioinformatics; Molecular Biology; Genetics; Genomics; Sequence Alignment; BLAST; FASTA Formats; SAM/BAM Formats; Variant Calling; RNA-seq Analysis; Single-cell Analysis; Genome Annotation; Phylogenetics; Protein Structure Analysis; Bioconductor; Biopython; Nextflow; Snakemake; Galaxy; Reproducible Scientific Workflows; Laboratory Information Systems; Biomedical Ontologies; Research Data Management; Clinical Data Privacy; Computational Biology; Biological Networks; Pathway Analysis; Scientific Data Visualization; Research Ethics; Clinical Validation; Bioscience Literature Search',
  'Analyze de-identified public scientific data with a reproducible workflow, validation and ethical limitations',
);

family(
  'emerging-domains',
  'other',
  'combine specialist knowledge with practical digital methods',
  'https://www.edx.org/learn',
  'EdTech Instructional Designer; Legal Tech Analyst; Sustainability/Climate Tech Analyst; Geospatial Developer; Quantum Computing Developer; Energy Data Analyst; Digital Accessibility Consultant',
  'Research Methods; Problem Solving; Data Ethics; Technical Communication',
  'Instructional Design; ADDIE; Backward Design; Bloom Taxonomy; Learning Objectives; Assessment Design; E-learning Storyboards; Articulate Storyline; Articulate Rise; H5P; SCORM; xAPI; Universal Design for Learning; Learning Analytics; Educational Technology Evaluation; Legal Technology; Legal Research; Contract Lifecycle Management; E-discovery; Legal Document Automation; Legal Operations; Legal Knowledge Management; Sustainability Analysis; Greenhouse Gas Accounting; Carbon Footprinting; Scope 1 Emissions; Scope 2 Emissions; Scope 3 Emissions; Life Cycle Assessment; Climate Scenario Analysis; Energy Systems; Renewable Energy Analysis; Environmental Data Analysis; Circular Economy; ESG Data Management; Geospatial Development; GeoPandas; Rasterio; GDAL; Leaflet; Mapbox; Remote Sensing; Satellite Imagery Analysis; Earth Engine; Quantum Computing; Qiskit; Cirq; Quantum Circuits; Quantum Gates; Quantum Algorithms; Quantum Error Correction; Quantum Simulation; Quantum Information Theory; Assistive Technology Evaluation; Accessible Document Design; Inclusive Service Evaluation',
  'Deliver a domain-specific prototype and evidence report, identifying professional review and qualification requirements',
);

// Common transferable foundations from the brief remain explicit catalog entries.
const foundations = {
  'delivery-leadership': [
    'Collaboration',
    'Critical Thinking',
    'Time Management',
    'Adaptability',
    'Ownership',
    'Presentation Skills',
    'Empathy',
    'Active Listening',
  ],
  'ml-research': ['MATLAB'],
  'backend-services': ['Operating Systems'],
};
for (const [id, names] of Object.entries(foundations)) {
  const target = families.find((family) => family.id === id);
  if (!target) throw new Error('Missing foundation family: ' + id);
  target.skills.push(...names.filter((name) => !target.skills.includes(name)));
}
