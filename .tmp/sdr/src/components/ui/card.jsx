"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Card = Card;
exports.CardHeader = CardHeader;
exports.CardBody = CardBody;
exports.CardFooter = CardFooter;
const cn_1 = require("@/lib/utils/cn");
function Card({ className, ...props }) {
    return (<section className={(0, cn_1.cn)("relative overflow-hidden rounded-[1.6rem] border border-semantic-border/55 bg-[linear-gradient(160deg,rgba(255,255,255,0.78),rgba(247,248,244,0.55))] shadow-[0_26px_70px_rgba(28,41,34,0.1)] backdrop-blur-md sm:rounded-[1.8rem]", "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-14 before:bg-[linear-gradient(180deg,rgba(255,255,255,0.6),transparent)]", "after:pointer-events-none after:absolute after:bottom-0 after:right-0 after:h-24 after:w-24 after:rounded-full after:bg-brand-100/35 after:blur-2xl", className)} {...props}/>);
}
function CardHeader({ className, ...props }) {
    return <header className={(0, cn_1.cn)("border-b border-semantic-border/45 px-4 py-4 sm:px-7 sm:py-5", className)} {...props}/>;
}
function CardBody({ className, ...props }) {
    return <div className={(0, cn_1.cn)("px-4 py-5 sm:px-7 sm:py-7", className)} {...props}/>;
}
function CardFooter({ className, ...props }) {
    return <footer className={(0, cn_1.cn)("border-t border-semantic-border/45 px-4 py-4 sm:px-7 sm:py-5", className)} {...props}/>;
}
