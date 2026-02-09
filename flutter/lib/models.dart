class UserProfile {
  const UserProfile({
    required this.id,
    required this.fullName,
    required this.email,
    required this.role,
    required this.group,
    required this.registeredAt,
    required this.blocked,
    required this.phone,
    required this.iin,
    required this.avatarUrl,
  });

  final String id;
  final String fullName;
  final String email;
  final String role;
  final String group;
  final String registeredAt;
  final bool blocked;
  final String phone;
  final String iin;
  final String avatarUrl;

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      id: json["id"]?.toString() ?? "",
      fullName: json["fullName"]?.toString() ?? "",
      email: json["email"]?.toString() ?? "",
      role: json["role"]?.toString() ?? "",
      group: json["group"]?.toString() ?? "",
      registeredAt: json["registeredAt"]?.toString() ?? "",
      blocked: json["blocked"] == true,
      phone: json["phone"]?.toString() ?? "",
      iin: json["iin"]?.toString() ?? "",
      avatarUrl: json["avatarUrl"]?.toString() ?? "",
    );
  }
}

class ChatUser {
  const ChatUser({
    required this.id,
    required this.fullName,
    required this.role,
  });

  final String id;
  final String fullName;
  final String role;

  factory ChatUser.fromJson(Map<String, dynamic> json) {
    return ChatUser(
      id: json['id']?.toString() ?? '',
      fullName: json['fullName']?.toString() ?? '',
      role: json['role']?.toString() ?? '',
    );
  }
}

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.roomId,
    required this.text,
    required this.createdAt,
    required this.sender,
  });

  final String id;
  final String roomId;
  final String text;
  final String createdAt;
  final ChatUser? sender;

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['id']?.toString() ?? '',
      roomId: json['roomId']?.toString() ?? '',
      text: json['text']?.toString() ?? '',
      createdAt: json['createdAt']?.toString() ?? '',
      sender: json['sender'] is Map<String, dynamic> ? ChatUser.fromJson(json['sender']) : null,
    );
  }
}

class ChatRoom {
  const ChatRoom({
    required this.id,
    required this.type,
    required this.title,
    required this.participants,
    required this.createdAt,
    required this.lastMessage,
  });

  final String id;
  final String type;
  final String title;
  final List<ChatUser> participants;
  final String createdAt;
  final ChatMessage? lastMessage;

  factory ChatRoom.fromJson(Map<String, dynamic> json) {
    return ChatRoom(
      id: json['id']?.toString() ?? '',
      type: json['type']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      participants: (json['participants'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(ChatUser.fromJson)
          .toList(),
      createdAt: json['createdAt']?.toString() ?? '',
      lastMessage: json['lastMessage'] is Map<String, dynamic>
          ? ChatMessage.fromJson(json['lastMessage'])
          : null,
    );
  }
}

class ChatOverview {
  const ChatOverview({
    required this.rooms,
    required this.contacts,
    required this.canViewAll,
  });

  final List<ChatRoom> rooms;
  final List<ChatUser> contacts;
  final bool canViewAll;

  factory ChatOverview.fromJson(Map<String, dynamic> json) {
    return ChatOverview(
      rooms: (json['rooms'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(ChatRoom.fromJson)
          .toList(),
      contacts: (json['contacts'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(ChatUser.fromJson)
          .toList(),
      canViewAll: json['canViewAll'] == true,
    );
  }
}

class Book {
  const Book({
    required this.id,
    required this.title,
    required this.author,
    required this.genre,
    required this.category,
    required this.cover,
    required this.description,
    required this.location,
    required this.year,
    required this.availableCopies,
    required this.totalCopies,
    required this.status,
    required this.inventoryNumber,
  });

  final String id;
  final String title;
  final String author;
  final String genre;
  final String category;
  final String cover;
  final String description;
  final String location;
  final String year;
  final int availableCopies;
  final int totalCopies;
  final String status;
  final String inventoryNumber;

  factory Book.fromJson(Map<String, dynamic> json) {
    return Book(
      id: json["id"]?.toString() ?? "",
      title: json["title"]?.toString() ?? "",
      author: json["author"]?.toString() ?? "",
      genre: json["genre"]?.toString() ?? "",
      category: json["category"]?.toString() ?? "",
      cover: json["cover"]?.toString() ?? "",
      description: json["description"]?.toString() ?? "",
      location: json["location"]?.toString() ?? "",
      year: json["year"]?.toString() ?? "",
      availableCopies: (json["availableCopies"] as num?)?.toInt() ?? 0,
      totalCopies: (json["totalCopies"] as num?)?.toInt() ?? 0,
      status: json["status"]?.toString() ?? "",
      inventoryNumber: json["inventoryNumber"]?.toString() ?? "",
    );
  }
}

class Loan {
  const Loan({
    required this.id,
    required this.studentId,
    required this.bookId,
    required this.issueDate,
    required this.dueDate,
    required this.returnDate,
    required this.status,
    required this.studentName,
    required this.studentGroup,
    required this.studentEmail,
    required this.bookTitle,
    required this.bookAuthor,
    required this.book,
  });

  final String id;
  final String studentId;
  final String bookId;
  final String issueDate;
  final String dueDate;
  final String returnDate;
  final String status;
  final String studentName;
  final String studentGroup;
  final String studentEmail;
  final String bookTitle;
  final String bookAuthor;
  final Book? book;

  factory Loan.fromJson(Map<String, dynamic> json) {
    return Loan(
      id: json["id"]?.toString() ?? "",
      studentId: json["studentId"]?.toString() ?? "",
      bookId: json["bookId"]?.toString() ?? "",
      issueDate: json["issueDate"]?.toString() ?? "",
      dueDate: json["dueDate"]?.toString() ?? "",
      returnDate: json["returnDate"]?.toString() ?? "",
      status: json["status"]?.toString() ?? "",
      studentName: json["studentName"]?.toString() ?? "",
      studentGroup: json["studentGroup"]?.toString() ?? "",
      studentEmail: json["studentEmail"]?.toString() ?? "",
      bookTitle: json["bookTitle"]?.toString() ?? "",
      bookAuthor: json["bookAuthor"]?.toString() ?? "",
      book: json["book"] is Map<String, dynamic> ? Book.fromJson(json["book"]) : null,
    );
  }
}

class StudentRequest {
  const StudentRequest({
    required this.id,
    required this.bookId,
    required this.studentId,
    required this.status,
    required this.createdAt,
    required this.bookTitle,
    required this.bookAuthor,
    required this.bookLocation,
    required this.availableCopies,
    required this.totalCopies,
    required this.studentName,
    required this.studentGroup,
    required this.studentEmail,
  });

  final String id;
  final String bookId;
  final String studentId;
  final String status;
  final String createdAt;
  final String bookTitle;
  final String bookAuthor;
  final String bookLocation;
  final int availableCopies;
  final int totalCopies;
  final String studentName;
  final String studentGroup;
  final String studentEmail;

  factory StudentRequest.fromJson(Map<String, dynamic> json) {
    return StudentRequest(
      id: json["id"]?.toString() ?? "",
      bookId: json["bookId"]?.toString() ?? "",
      studentId: json["studentId"]?.toString() ?? "",
      status: json["status"]?.toString() ?? "",
      createdAt: json["createdAt"]?.toString() ?? "",
      bookTitle: json["bookTitle"]?.toString() ?? "",
      bookAuthor: json["bookAuthor"]?.toString() ?? "",
      bookLocation: json["bookLocation"]?.toString() ?? "",
      availableCopies: (json["availableCopies"] as num?)?.toInt() ?? 0,
      totalCopies: (json["totalCopies"] as num?)?.toInt() ?? 0,
      studentName: json["studentName"]?.toString() ?? "",
      studentGroup: json["studentGroup"]?.toString() ?? "",
      studentEmail: json["studentEmail"]?.toString() ?? "",
    );
  }
}

class FavoriteItem {
  const FavoriteItem({
    required this.id,
    required this.bookId,
    required this.book,
  });

  final String id;
  final String bookId;
  final Book? book;

  factory FavoriteItem.fromJson(Map<String, dynamic> json) {
    return FavoriteItem(
      id: json["id"]?.toString() ?? "",
      bookId: json["bookId"]?.toString() ?? "",
      book: json["book"] is Map<String, dynamic> ? Book.fromJson(json["book"]) : null,
    );
  }
}

class AdminStats {
  const AdminStats({
    required this.totalBooks,
    required this.issuedToday,
    required this.issuedWeek,
    required this.overdue,
    required this.activeLoans,
    required this.popularBooks,
    required this.usersByRole,
    required this.booksByGenre,
    required this.weeklyIssues,
  });

  final int totalBooks;
  final int issuedToday;
  final int issuedWeek;
  final int overdue;
  final int activeLoans;
  final List<Map<String, dynamic>> popularBooks;
  final Map<String, dynamic> usersByRole;
  final Map<String, dynamic> booksByGenre;
  final List<dynamic> weeklyIssues;

  factory AdminStats.fromJson(Map<String, dynamic> json) {
    return AdminStats(
      totalBooks: (json["totalBooks"] as num?)?.toInt() ?? 0,
      issuedToday: (json["issuedToday"] as num?)?.toInt() ?? 0,
      issuedWeek: (json["issuedWeek"] as num?)?.toInt() ?? 0,
      overdue: (json["overdue"] as num?)?.toInt() ?? 0,
      activeLoans: (json["activeLoans"] as num?)?.toInt() ?? 0,
      popularBooks: (json["popularBooks"] as List<dynamic>? ?? []).cast<Map<String, dynamic>>(),
      usersByRole: (json["usersByRole"] as Map<String, dynamic>? ?? {}),
      booksByGenre: (json["booksByGenre"] as Map<String, dynamic>? ?? {}),
      weeklyIssues: (json["weeklyIssues"] as List<dynamic>? ?? []),
    );
  }
}
