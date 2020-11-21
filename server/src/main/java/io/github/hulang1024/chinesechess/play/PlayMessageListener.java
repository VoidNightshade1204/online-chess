package io.github.hulang1024.chinesechess.play;

import io.github.hulang1024.chinesechess.play.message.*;
import io.github.hulang1024.chinesechess.play.rule.ChessboardState;
import io.github.hulang1024.chinesechess.room.LobbyService;
import io.github.hulang1024.chinesechess.room.Room;
import io.github.hulang1024.chinesechess.room.RoomManager;
import io.github.hulang1024.chinesechess.room.RoomStatus;
import io.github.hulang1024.chinesechess.user.User;
import io.github.hulang1024.chinesechess.user.UserManager;
import io.github.hulang1024.chinesechess.websocket.message.AbstractMessageListener;
import io.github.hulang1024.chinesechess.websocket.message.server.lobby.LobbyRoomUpdateServerMsg;
import io.github.hulang1024.chinesechess.websocket.message.server.play.*;
import io.github.hulang1024.chinesechess.websocket.message.server.spectator.SpectatorPlayRoundStartServerMsg;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class PlayMessageListener extends AbstractMessageListener {
    @Autowired
    private LobbyService lobbyService;
    @Autowired
    private RoomManager roomManager;
    @Autowired
    private UserManager userManager;

    @Override
    public void init() {
        addMessageHandler(ReadyMsg.class, this::ready);
        addMessageHandler(ChessPickMsg.class, this::pickChess);
        addMessageHandler(ChessMoveMsg.class, this::moveChess);
        addMessageHandler(GameOverMsg.class, this::onRoundOver);
        addMessageHandler(ConfirmRequestMsg.class, this::onConfirmRequest);
        addMessageHandler(ConfirmResponseMsg.class, this::onConfirmResponse);
    }

    public void ready(ReadyMsg readyMsg) {
        User user = userManager.getOnlineUser(readyMsg.getSession());
        Room room = roomManager.getJoinedRoom(user);
        UserGameState userGameState = room.getUserGameState(user);

        if (room == null) {
            return;
        }

        userGameState.setReadied(readyMsg.getReadied() != null
            ? readyMsg.getReadied()
            : !userGameState.isReadied());

        ReadyServerMsg readyServerMsg = new ReadyServerMsg();
        readyServerMsg.setCode(0);
        readyServerMsg.setUid(user.getId());
        readyServerMsg.setReadied(userGameState.isReadied());

        roomManager.broadcast(room, readyServerMsg);

        lobbyService.broadcast(new LobbyRoomUpdateServerMsg(room), user);

        // 如果全部准备好，开始游戏
        boolean isAllReadied = room.getUserCount() == Room.MAX_PARTICIPANTS
            && room.getUsers().stream().allMatch(u -> room.getUserGameState(u).isReadied());
        if (isAllReadied) {
            startRound(room);
        }
    }

    private void pickChess(ChessPickMsg chessPickMsg) {
        User user = userManager.getOnlineUser(chessPickMsg.getSession());
        Room room = roomManager.getJoinedRoom(user);

        ChessPickServerMsg chessPickServerMsg = new ChessPickServerMsg();
        chessPickServerMsg.setChessHost(room.getChessHost(user).code());
        chessPickServerMsg.setPos(chessPickMsg.getPos());
        chessPickServerMsg.setPickup(chessPickMsg.isPickup());

        roomManager.broadcast(room, chessPickServerMsg, user);
    }

    private void moveChess(ChessMoveMsg chessMoveMsg) {
        User user = userManager.getOnlineUser(chessMoveMsg.getSession());
        Room room = roomManager.getJoinedRoom(user);

        ChessboardState chessboardState = room.getGame().getChessboardState();

        // 记录动作
        ChessAction action = new ChessAction();
        action.setChessHost(room.getChessHost(user));
        action.setChessType(chessboardState.chessAt(chessMoveMsg.getFromPos(), action.getChessHost()).type);
        action.setFromPos(chessMoveMsg.getFromPos());
        action.setToPos(chessMoveMsg.getToPos());
        if (chessMoveMsg.getMoveType() == 2) {
            action.setEatenChess(chessboardState.chessAt(chessMoveMsg.getToPos(), action.getChessHost()));
        }
        room.getGame().getActionStack().push(action);

        chessboardState.moveChess(
            chessMoveMsg.getFromPos(), chessMoveMsg.getToPos(), room.getChessHost(user));
        
        room.getGame().turnActiveChessHost();

        ChessMoveResult result = new ChessMoveResult();
        result.setChessHost(room.getChessHost(user).code());
        result.setMoveType(chessMoveMsg.getMoveType());
        result.setFromPos(chessMoveMsg.getFromPos());
        result.setToPos(chessMoveMsg.getToPos());

        roomManager.broadcast(room, result);
    }

    private void onConfirmRequest(ConfirmRequestMsg confirmRequestMsg) {
        User user = userManager.getOnlineUser(confirmRequestMsg.getSession());
        Room room = roomManager.getJoinedRoom(user);

        PlayConfirmServerMsg result = new PlayConfirmServerMsg();
        result.setReqType(confirmRequestMsg.getReqType());
        result.setChessHost(room.getChessHost(user).code());

        roomManager.broadcast(room, result);
    }

    private void onConfirmResponse(ConfirmResponseMsg confirmResponseMsg) {
        User user = userManager.getOnlineUser(confirmResponseMsg.getSession());
        Room room = roomManager.getJoinedRoom(user);

        PlayConfirmResponseServerMsg result = new PlayConfirmResponseServerMsg();
        result.setReqType(confirmResponseMsg.getReqType());
        result.setChessHost(room.getChessHost(user).code());
        result.setOk(confirmResponseMsg.isOk());

        if (confirmResponseMsg.isOk()) {
            if (confirmResponseMsg.getReqType() == ConfirmRequestType.WHITE_FLAG.code()) {
                //todo something
            } else if (confirmResponseMsg.getReqType() == ConfirmRequestType.DRAW.code()) {
                //todo something
            } else if (confirmResponseMsg.getReqType() == ConfirmRequestType.WITHDRAW.code()) {
                withdraw(room);
                room.getGame().turnActiveChessHost();
            }
        }

        roomManager.broadcast(room, result);
    }

    private void withdraw(Room room) {
        ChessboardState chessboardState = room.getGame().getChessboardState();
        if (room.getGame().getActionStack().isEmpty()) {
            return;
        }
        ChessAction lastAction = room.getGame().getActionStack().pop();
        chessboardState.moveChess(lastAction.getToPos(), lastAction.getFromPos(), lastAction.getChessHost());
        if (lastAction.getEatenChess() != null) {
            chessboardState.setChess(lastAction.getToPos(), lastAction.getEatenChess(), lastAction.getChessHost());
        }
    }

    private void startRound(Room room) {
        Game round = new Game();
        room.setGame(round);

        room.setRoundCount(room.getUserCount() + 1);

        if (room.getRoundCount() > 1) {
            // 第n个对局，交换棋方
            User redChessUser = room.getRedChessUser();
            User blackChessUser = room.getBlackChessUser();
            room.setBlackChessUser(redChessUser);
            room.setRedChessUser(blackChessUser);
        }

        room.setStatus(RoomStatus.PLAYING);

        PlayRoundStart redStart = new PlayRoundStart();
        redStart.setChessHost(1);
        send(redStart, room.getRedChessUser());

        PlayRoundStart blackStart = new PlayRoundStart();
        blackStart.setChessHost(2);
        send(blackStart, room.getBlackChessUser());

        // 观众
        SpectatorPlayRoundStartServerMsg roundStart = new SpectatorPlayRoundStartServerMsg();
        roundStart.setRedChessUid(room.getRedChessUser().getId());
        roundStart.setBlackChessUid(room.getBlackChessUser().getId());
        room.getSpectators().forEach(user -> {
            send(roundStart, user);
        });
    }

    private void onRoundOver(GameOverMsg msg) {
        User user = userManager.getOnlineUser(msg.getSession());
        Room room = roomManager.getJoinedRoom(user);
        room.setStatus(RoomStatus.BEGINNING);
        lobbyService.broadcast(new LobbyRoomUpdateServerMsg(room), user);
    }
}