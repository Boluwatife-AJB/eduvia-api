import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClsService } from 'nestjs-cls';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { PrismaService } from 'src/database/prisma.service';
import { QueryNotificationsDto } from './dto/notifications.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly cls: ClsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get notifications' })
  async getMyNotifications(
    @CurrentUser() user: { id: string },
    @Query() query: QueryNotificationsDto,
  ) {
    const { page = 1, limit = 20, unread_only } = query;

    const where = {
      user_id: user.id,
      ...(unread_only && { is_read: false }),
    };

    const [notifications, total, unread_count] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { user_id: user.id, is_read: false },
      }),
    ]);

    return {
      data: notifications,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        unread_count,
      },
    };
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark notification as read' })
  async markNotificationAsRead(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    await this.prisma.notification.updateMany({
      where: { id, user_id: user.id },
      data: { is_read: true },
    });

    return {
      message: 'Notification marked as read',
    };
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllNotificationsAsRead(@CurrentUser() user: { id: string }) {
    await this.prisma.notification.updateMany({
      where: { user_id: user.id, is_read: false },
      data: { is_read: true },
    });

    return {
      message: 'All notifications marked as read',
    };
  }
}
