# Provider Profile System

This project is a NestJS application that implements a provider profile system for signal providers. It includes features such as public stats, verification badges, and follower tracking.

## Features

- **Provider Profiles**: Each provider has a profile displaying their stats, bio, and track record.
- **Public Stats**: Providers can showcase their performance metrics, including win rate, total signals, and follower count.
- **Verification Badges**: Providers who stake a minimum amount (1000 XLM) receive a verification badge to build credibility.
- **Follower Tracking**: Users can follow or unfollow providers, and the system tracks the number of followers.

## API Endpoints

- `GET /providers/:walletAddress`: Retrieve the provider profile by wallet address.
- `PUT /providers/profile`: Update the authenticated user's own profile.

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd provider-profile-system
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file based on the `.env.example` file and configure your environment variables.

4. Run the application:
   ```
   npm run start
   ```

## Folder Structure

```
provider-profile-system
├── src
│   ├── providers
│   │   ├── providers.service.ts
│   │   ├── providers.controller.ts
│   │   ├── providers.module.ts
│   │   ├── entities
│   │   │   ├── provider-profile.entity.ts
│   │   │   └── provider-follower.entity.ts
│   │   └── dto
│   │       ├── provider-profile.dto.ts
│   │       ├── update-profile.dto.ts
│   │       └── create-profile.dto.ts
│   ├── signals
│   │   ├── signals.service.ts
│   │   ├── entities
│   │   │   └── signal.entity.ts
│   │   └── dto
│   │       └── signal.dto.ts
│   ├── cache
│   │   ├── cache.service.ts
│   │   └── cache.module.ts
│   ├── verification
│   │   ├── verification.service.ts
│   │   └── verification.module.ts
│   ├── common
│   │   ├── decorators
│   │   │   └── auth.decorator.ts
│   │   ├── guards
│   │   │   └── auth.guard.ts
│   │   └── interfaces
│   │       └── index.ts
│   ├── app.module.ts
│   └── main.ts
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Usage

- To create or update a provider profile, use the appropriate API endpoints.
- Follow or unfollow providers to track their updates and stats.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or features you'd like to add.