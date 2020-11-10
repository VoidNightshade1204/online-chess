import messager from "../../component/messager";
import socketClient from "../../online/socket";
import Room from "../../online/socket-message/response/Room";
import AbstractScene from "../AbstractScene";
import chatOverlay from "../../overlay/chat/chat";
import ChatChannel from "../../overlay/chat/Channel";
import SceneContext from "../SceneContext";
import DisplayChessboard from "./DisplayChessboard";
import Player from "./Player";
import ChessK from "./rule/chess/ChessK";
import ChessHost, { reverseChessHost } from "./rule/chess_host";
import SpectatorTextOverlay from "./TextOverlay";
import UserInfoPane from "./UserInfoPane";

export default class SpectatorPlayScene extends AbstractScene {
    // socket消息监听器
    private listeners = {};
    private viewChessHost: ChessHost;
    private activeChessHost: ChessHost;
    private player: Player;
    private room: Room;
    private chessboard: DisplayChessboard;
    private textOverlay = new SpectatorTextOverlay();
    private userInfoPaneGroup = new eui.Group();
    private redChessUserInfoPane = new UserInfoPane();
    private blackChessUserInfoPane = new UserInfoPane();
    private lblSpectatorNum = new eui.Label();

    constructor(context: SceneContext, roomRoundState: any) {
        super(context);

        let layout = new eui.VerticalLayout();
        layout.paddingLeft = 8;
        layout.paddingTop = 8;
        layout.paddingRight = 8;
        layout.paddingBottom = 8;
        let group = new eui.Group();
        group.layout = layout;
        this.addChild(group);

        this.player = new Player();
        this.chessboard = this.player.chessboard;
        this.viewChessHost = ChessHost.BLACK;
        this.activeChessHost = roomRoundState.activeChessHost;
        this.room = roomRoundState.room;
        this.player.startRound(this.viewChessHost, this.activeChessHost, roomRoundState.chesses);

        // 头部
        let head = new eui.Group();
        head.height = 60;
        head.layout = new eui.VerticalLayout();
        group.addChild(head);

        let headInfoLayout = new eui.HorizontalLayout();
        headInfoLayout.horizontalAlign = egret.HorizontalAlign.JUSTIFY;
        let headInfo = new eui.Group();
        headInfo.width = 530;
        headInfo.layout = headInfoLayout;
        headInfo.height = 20;

        let lblRoomName = new eui.Label();
        lblRoomName.width = 300;
        lblRoomName.size = 20;
        lblRoomName.text = '房间: ' + this.room.name;
        headInfo.addChild(lblRoomName);

        let { lblSpectatorNum } = this;
        lblSpectatorNum.size = 20;
        headInfo.addChild(lblSpectatorNum);

        head.addChild(headInfo);

        this.updateSpectatorCount(this.room.spectatorCount);

        let userPaneLayout = new eui.HorizontalLayout();
        userPaneLayout.gap = 200;
        userPaneLayout.horizontalAlign = egret.HorizontalAlign.JUSTIFY;
        this.userInfoPaneGroup.width = 530;
        this.userInfoPaneGroup.layout = userPaneLayout;
        this.addUserInfoPaneByView();
        head.addChild(this.userInfoPaneGroup);

        let redChessUser: any;
        let blackChessUser: any;
        roomRoundState.room.users.forEach(user => {
            if (user.chessHost == ChessHost.BLACK) {
                blackChessUser = user;
            } else {
                redChessUser = user;
            }
        });
        this.redChessUserInfoPane.load(redChessUser);
        this.blackChessUserInfoPane.load(blackChessUser);

        group.addChild(this.player);

        let buttonGroup = new eui.Group();
        let buttonGroupLayout = new eui.HorizontalLayout();
        buttonGroupLayout.paddingTop = 32;
        buttonGroupLayout.gap = 24;
        buttonGroup.layout = buttonGroupLayout;
        group.addChild(buttonGroup);

        // 离开按钮
        let btnLeave = new eui.Button();
        btnLeave.width = 120;
        btnLeave.height = 50;
        btnLeave.label = "离开房间";
        btnLeave.addEventListener(egret.TouchEvent.TOUCH_TAP, () => {
            socketClient.send('spectator.leave');
            this.popScene();
        }, this);
        buttonGroup.addChild(btnLeave);

        // 切换视角按钮
        let btnChangeChessHost = new eui.Button();
        btnChangeChessHost.width = 120;
        btnChangeChessHost.height = 50;
        btnChangeChessHost.label = "切换视角";
        btnChangeChessHost.addEventListener(egret.TouchEvent.TOUCH_TAP, () => {
            this.player.reverseChessLayoutView();
            this.viewChessHost = reverseChessHost(this.viewChessHost);
            this.userInfoPaneGroup.removeChild(this.redChessUserInfoPane);
            this.userInfoPaneGroup.removeChild(this.blackChessUserInfoPane);
            this.addUserInfoPaneByView();
        }, this);
        buttonGroup.addChild(btnChangeChessHost);

        // 聊天切换按钮
        let btnChat = new eui.Button();
        btnChat.width = 120;
        btnChat.label = "聊天";
        btnChat.addEventListener(egret.TouchEvent.TOUCH_TAP, () => {
            chatOverlay.toggleVisible();
        }, this);
        buttonGroup.addChild(btnChat);

        this.chessboard.addChild(this.textOverlay);
        if (roomRoundState.room.status == 2) {
            this.textOverlay.show('有人还未准备开始，请等待');
        }

        if (this.activeChessHost != null) {
            (this.activeChessHost == ChessHost.RED
                ? this.redChessUserInfoPane
                : this.blackChessUserInfoPane).setActive(true);
        }

        this.initListeners();

        let channel = new ChatChannel();
        channel.id = this.room.chatChannelId;
        channel.name = `当前房间`;
        chatOverlay.addChannel(channel);
        chatOverlay.toggleVisible();
    }

    onSceneExit() {
        for (let key in this.listeners) {
            socketClient.signals[key].remove(this.listeners[key]);
        }

        chatOverlay.removeChannel(this.room.chatChannelId);
    }

    private initListeners() {
        this.chessboard.addEventListener(egret.TouchEvent.TOUCH_TAP, () => {
            chatOverlay.visible = false;
        }, this);
        
        socketClient.add('spectator.join', this.listeners['spectator.join'] = (msg: any) => {
            this.updateSpectatorCount(msg.spectatorCount);
        });

        socketClient.add('spectator.leave', this.listeners['spectator.leave'] = (msg: any) => {
            this.updateSpectatorCount(msg.spectatorCount);
        });

        socketClient.add('room.join', this.listeners['room.join'] = (msg: any) => {
            this.textOverlay.show('玩家加入', 3000);
            
            if (msg.user.chessHost == ChessHost.RED) {
                let user = this.redChessUserInfoPane.getUser();
                user.chessHost = ChessHost.BLACK;
                this.redChessUserInfoPane.load(msg.user);
                this.blackChessUserInfoPane.load(user);
            } else {
                let user = this.blackChessUserInfoPane.getUser();
                user.chessHost = ChessHost.RED;
                this.blackChessUserInfoPane.load(msg.user);
                this.redChessUserInfoPane.load(user);
            }
        });
        
        socketClient.add('room.leave', this.listeners['room.leave'] = (msg: any) => {
            let leaveChessHost: ChessHost;
            if (this.redChessUserInfoPane.getUser()
                && msg.user.id == this.redChessUserInfoPane.getUser().id) {
                leaveChessHost = ChessHost.RED;
            } else {
                leaveChessHost = ChessHost.BLACK;
            }

            this.textOverlay.show(`${leaveChessHost == ChessHost.RED ? '红方' : '黑方'}玩家离开`);

            (leaveChessHost == ChessHost.RED
                ? this.redChessUserInfoPane
                : this.blackChessUserInfoPane).load(null);

            
            if (this.redChessUserInfoPane.getUser() == null && this.blackChessUserInfoPane.getUser() == null) {
                messager.info('观看房间玩家已全部离开', this.stage);
                this.popScene();
                return;
            }

            this.redChessUserInfoPane.setActive(false);
            this.blackChessUserInfoPane.setActive(false);
            this.activeChessHost = null;
        });

        socketClient.add('chessplay.ready', this.listeners['chessplay.ready'] = (msg: any) => {
            if (!msg.readyed) {
                this.textOverlay.show('有人还未准备开始，请等待');
            }
        });

        socketClient.add('spectator.chessplay.round_start', this.listeners['spectator.chessplay.round_start'] = (msg: any) => {
            this.textOverlay.show('对局开始', 3000);
            this.turnActiveChessHost();
        });

        socketClient.add('chessplay.chess_pick', this.listeners['chessplay.chess_pick'] = (msg) => {            
            this.player.pickChess(msg.pickup, msg.pos, msg.chessHost);
        });

        socketClient.add('chessplay.chess_move', this.listeners['chessplay.chess_move'] = (msg: any) => {
            switch (msg.moveType) {
            case 1:
                this.player.moveChess(msg.fromPos, msg.toPos, msg.chessHost);
                this.turnActiveChessHost();
                break;
            case 2:
                let targetPos = this.player.convertViewPos(msg.toPos, msg.chessHost);
                let targetChess = this.chessboard.chessAt(targetPos.row, targetPos.col);
    
                this.player.eatChess(msg.fromPos, msg.toPos, msg.chessHost);
    
                if (targetChess.getChess() instanceof ChessK) {
                    this.onRoundEnd(targetChess.getHost() != this.viewChessHost);
                } else {
                    this.turnActiveChessHost();
                }
                break;
            }
        });
    }

    private turnActiveChessHost() {
        if (this.activeChessHost == null) {
            this.activeChessHost = ChessHost.RED;
        } else {
            this.activeChessHost = reverseChessHost(this.activeChessHost);
        }

        this.redChessUserInfoPane.setActive(this.activeChessHost == ChessHost.RED);
        this.blackChessUserInfoPane.setActive(this.activeChessHost == ChessHost.BLACK);
    }
    
    private onRoundEnd(isWin: boolean) {

    }

    private updateSpectatorCount = (count: number) => {
        this.lblSpectatorNum.text = `观众数: ${count}`;
    }

    private addUserInfoPaneByView() {
        let left: UserInfoPane;
        let right: UserInfoPane;
        if (this.viewChessHost == ChessHost.RED) {
            left = this.blackChessUserInfoPane;
            right = this.redChessUserInfoPane;
        } else {
            left = this.redChessUserInfoPane;
            right = this.blackChessUserInfoPane;
        }

        this.userInfoPaneGroup.addChild(left);
        this.userInfoPaneGroup.addChild(right);
    }
}