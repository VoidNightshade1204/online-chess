package io.github.hulang1024.chinesechess.client.message;

/**
 * 消息处理器
 */
public interface MessageHandler<T> {
  void handle(T message);
}