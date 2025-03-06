// src/index.ts
import {
    EventType,
    SignerData,
    SignerType
} from "iz-nostrlib";
import WebTorrent from "webtorrent";
import SimplePeer from "simple-peer";
import {randomUUID} from "node:crypto";
import {mkdirSync} from "fs";
import ffmpeg from 'fluent-ffmpeg';
import path from "node:path";
import fs from "node:fs";
import {GlobalNostrContext, asyncCreateWelshmanSession, Identifier, Identity, CommunityNostrContext} from "iz-nostrlib/communities";
import {BotConfig} from "./config.js";
import {DynamicPublisher} from "iz-nostrlib/ses";
import {Nip9999SeederTorrentTransformationRequestEvent,
    Nip9999SeederTorrentTransformationResponseEvent, NostrCommunityServiceBot} from "iz-nostrlib/seederbot";
import {setContext} from "@red-token/welshman/lib";
import {getDefaultAppContext, getDefaultNetContext} from "@red-token/welshman/app";
import {normalizeRelayUrl, TrustedEvent} from "@red-token/welshman/util";

console.log("Starting...");

const rtcConfig = {
    iceServers: [
        {
            urls: [
                "turn:turn.stream.labs.h3.se",
            ],
            username: "test",
            credential: "testme",
        },
        {
            urls:
                ["stun:stun.stream.labs.h3.se"],
            username: "test",
            credential: "testme",
        }],
    iceTransportPolicy: "all",
    iceCandidatePoolSize: 0,
}

const options = {
    announce: ['wss://tracker.webtorrent.dev', 'wss://tracker.btorrent.xyz', 'wss://tracker.openwebtorrent.com'],
    maxWebConns: 500
};

const wt = new WebTorrent({
    tracker: {
        rtcConfig: {
            ...SimplePeer.config,
            ...rtcConfig
        }
    },
});

setContext({
    net: getDefaultNetContext(),
    app: getDefaultAppContext()
});

const botConfig = new BotConfig()


console.log("BOT STARTED DONE")
