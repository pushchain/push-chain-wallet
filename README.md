<h1 align="center">
    <a href="https://push.org/#gh-light-mode-only">
    <img width='20%' height='10%' src="https://res.cloudinary.com/drdjegqln/image/upload/v1686227557/Push-Logo-Standard-Dark_xap7z5.png">
    </a>
    <a href="https://push.org/#gh-dark-mode-only">
    <img width='20%' height='10%' src="https://res.cloudinary.com/drdjegqln/image/upload/v1686227558/Push-Logo-Standard-White_dlvapc.png">
    </a>
</h1>

<p align="center">
  <i align="center">Push protocol is evolving to Push Chain, a shared-state L1 designed to deliver universal app experiences (Any Chain. Any User. Any App).🚀</i>
</p>

<h4 align="center">

  <a href="https://discord.com/invite/pushchain">
    <img src="https://img.shields.io/badge/discord-7289da.svg?style=flat-square" alt="discord">
  </a>
  <a href="https://x.com/pushprotocol">
    <img src="https://img.shields.io/twitter/follow/push-protocol" alt="twitter">
  </a>
  <a href="https://www.youtube.com/@pushprotocol">
    <img src="https://img.shields.io/badge/youtube-d95652.svg?style=flat-square&" alt="youtube">
  </a>
</h4>

# Push Wallet

Push Wallet provide a secure, user-friendly, and interoperable key management solution for the Push unified network, enabling seamless interactions across multiple blockchain networks while safeguarding user security and privacy.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Installation](#installation)
- [Contributing](#contributing)
- [License](#license)

## Overview

Push Keys offer a robust architecture for managing cryptographic keys in a secure environment, allowing users to interact with any blockchain network through a unified user profile. The architecture emphasizes security, usability, and interoperability, ensuring seamless user experience across Web3 applications while maintaining high performance and security standards.

## Architecture

### 1. **Key Generation**

- Keys are generated using BIP-39 mnemonic phrases and BIP-32 hierarchical deterministic (HD) wallets.
- This method allows easy backup and restoration of keys using mnemonic phrases, supporting infinite key derivations for various purposes within the Push network.

### 2. **Key Interaction**

- Keys are managed within a secure, isolated iFrame environment.
- The isolated environment ensures keys are never exposed, significantly enhancing security.

### 3. **Enabling Multi Wallet Account Management**

- Push Key architecture integrates different wallet addresses, allowing each to sign data within the secure environment.
- A derived key from the master key is encrypted for all linked wallet accounts, facilitating seamless transaction mapping for individual wallets and the unified user.

### 4. **Simplifying UX with Session Keys**

- Session keys are generated to improve UX by reducing direct interaction with the secure environment.
- While session keys simplify user interactions, they can be automatically or manually revoked to balance security and usability.

### 5. **Data Encryption**

- Transaction data can be encrypted using the derived public key of the unified user to ensure private and secure communication between participants.
- This process protects sensitive information, ensuring confidentiality and security.

### 6. **Key Rotation and Revocation**

- Mnemonic owners can change derived keys, effectively resetting all connected accounts, a process known as key rotation.
- This feature, along with session key revocation, ensures ongoing security by allowing users to mitigate risks if any key is compromised.

### 7. **Key Storage**

- **Mnemonic Custody**: The mnemonic phrase is not stored and remains solely with the user.
- **Unified User Details Storage**: Unified user details, along with the master public and derived public keys, are stored on Push storage nodes.
- **Web3 Account Registration**: Web3 accounts are linked to the unified user through transactions, with encrypted derived keys associated with each account.
- **Session Key Registration**: Session keys for Web3 apps are registered and linked to the unified user.
- **Key Rotation and Revocation**: Users can reset or revoke derived keys and session keys to maintain security and control.

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/push-protocol/push-wallet.git
   cd push-wallet
   ```

2. **Install Dependencies**

   ```bash
   npm install
   ```

3. **Run project in development mode**

   ```bash
   npm run dev
   ```

4. **Run project tests**

   ```bash
   npm run test
   ```

## Contributing

We welcome contributions from the community! To contribute, please follow these steps:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature/your-feature-name`).
3. Make your changes and commit them (`git commit -m 'Add some feature'`).
4. Push to the branch (`git push origin feature/your-feature-name`).
5. Open a pull request.

Please ensure your code adheres to our coding standards and includes appropriate tests.

## License

All crates of this repository are licensed under either of

- Apache License, Version 2.0, ([LICENSE-APACHE](LICENSE-APACHE) or http://www.apache.org/licenses/LICENSE-2.0)
- MIT license ([LICENSE-MIT](LICENSE-MIT) or http://opensource.org/licenses/MIT)

at your option.
