import { useContext, useEffect, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import Col from 'react-bootstrap/Col'
import { Widget, addResponseMessage, addUserMessage, renderCustomComponent } from 'react-chat-widget';
import 'react-chat-widget/lib/styles.css';
import { AppContext } from "../../App.js"
import { CHAT_HISTORY_URL, BACKEND_DOMAIN, CHAT_SOCKET_PATH, CHAT_BACKEND_DOMAIN } from "../../Api.js";
import "../../css/Chat.css"
import { useHistory } from "react-router-dom";
import useState from 'react-usestateref';

function Chat() {
    let { user, matchRef } = useContext(AppContext);
    const history = useHistory();

    var interviewId = null;
    var chatSocket = useRef();
    const [chats, setChats, chatsRef] = useState([]);

    useEffect(() => {
        if (matchRef.current === null) {
            history.push({ pathname: '/' });
        }

        interviewId = matchRef.current.interviewId;

        chatSocket.current = io.connect(CHAT_BACKEND_DOMAIN, {
            transports: ["websocket"],
            path: CHAT_SOCKET_PATH,
            withCredentials: true,
            reconnection: true,
            reconnectionDelay: 500
        });

        chatSocket.current.emit("joinRoom", interviewId);

        chatSocket.current.on("connect", () => {
            console.log("Successfully connected to chat socket.");
            console.log(chats);

            // Fetch and populate chat history.
            axios.get(CHAT_HISTORY_URL + interviewId).then(res => {
                console.log(res.data);
                if (res.data.status === "success" && res.data.data) {
                    console.log("We are here", res.data)
                    const chatHistory = res.data.data.history;
                    setChats(chatHistory);
                }
                console.log(chatsRef.current);

                /**
                 * Push chat history from chats variable into chat widget
                 */
                for (let chat of chatsRef.current) {
                    console.log(chat);
                    if (chat.senderEmail === user.email) {
                        addUserMessage(chat.message);
                    } else {
                        addResponseMessage(chat.message);
                    }
                }
            }).catch(err => console.log("Error fetching chat history", err));

            /**
             * Set event upon receiving new message to add to chats variable and to chat widget.
             */
            chatSocket.current.on("message", newMessage => {
                console.log("Received msg from chat socket", newMessage);
                setChats(oldMessages => [...oldMessages, newMessage]);
                if (newMessage.senderEmail !== user.email) {
                    addResponseMessage(newMessage.message);
                }
            });

            /**
             * Receive disconnection message
             */
            chatSocket.current.on("end_interview", endInterviewMessage => {
                setChats(oldMessages => [...oldMessages, endInterviewMessage]);
                if (endInterviewMessage.senderEmail !== user.email) {
                    renderCustomComponent(<p>{endInterviewMessage.message}</p>);
                }
            })

        });

        const SECONDS_TO_MICROSECONDS_MULTIPLIER = 1000;
        // Upon timeout, close socket to conserve resources
        setTimeout(() => {
            chatSocket.current.disconnect();
            chatSocket.current.close();
        }, matchRef.current.durationLeft * SECONDS_TO_MICROSECONDS_MULTIPLIER);

        // When tearing down Chat component, close the socket.
        return () => {
            console.log("Closing chat socket");
            chatSocket.current.emit("end_interview", {
                interviewId: matchRef.current.interviewId,
                contents: {
                    senderEmail: user.email,
                    message: "Your partner has disconnected."
                }
            })
            setChats([]);
            chatSocket.current.disconnect();
            chatSocket.current.close();
        }
    }, [matchRef]);


    /**
     * Upon user entering new message into chat widget, send to socket.
     */
    const handleNewUserMessage = (msgString) => {
        console.log(`New message incoming! ${msgString}`);

        const newChat = { senderEmail: user.email, message: msgString }
        chatSocket.current.emit("message", {
            interviewId: matchRef.current.interviewId,
            contents: newChat
        });
    };

    return (
        <Col md={3} className="chat-col">
            <Widget
                handleNewUserMessage={handleNewUserMessage}
                title="Chat"
                subtitle=""
                showTimeStamp={false}
            />
        </Col>
    )
}

export default Chat;