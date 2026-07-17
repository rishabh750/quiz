package com.interviewprep.web;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.interviewprep.model.Course;
import com.interviewprep.model.Question;
import com.interviewprep.model.User;
import com.interviewprep.repo.AnswerRepository;
import com.interviewprep.repo.CourseRepository;
import com.interviewprep.security.ApiException;
import com.interviewprep.security.AuthUser;
import com.interviewprep.service.QuizParser;

@RestController
@RequestMapping("/api")
@Transactional
public class CourseController {

    private final CourseRepository courses;
    private final AnswerRepository answers;
    private final QuizParser parser;

    public CourseController(CourseRepository courses, AnswerRepository answers, QuizParser parser) {
        this.courses = courses;
        this.answers = answers;
        this.parser = parser;
    }

    @GetMapping("/courses")
    public List<String> listCourses(@AuthUser User user) {
        return names(user, false);
    }

    @GetMapping("/archive")
    public List<String> listArchive(@AuthUser User user) {
        return names(user, true);
    }

    @PostMapping("/courses")
    public Map<String, String> upload(@AuthUser User user, @RequestBody Dto.UploadRequest body) {
        String base = body.filename() == null ? "" : body.filename().replaceAll("^.*[\\\\/]", "");
        if (!base.matches("(?i).*\\.(txt|md)$")) {
            throw new ApiException(400, "only .txt and .md files are allowed");
        }
        String name = base.replaceAll("(?i)\\.(txt|md)$", "");
        boolean isMd = base.matches("(?i).*\\.md$");

        Course course = courses.findByUserIdAndName(user.getId(), name).orElse(null);
        if (course == null) {
            course = new Course();
            course.setUserId(user.getId());
            course.setName(name);
        }
        String content = body.content() == null ? "" : body.content();
        if (isMd) {
            course.setNotes(content);
        } else {
            course.getQuestions().clear();
            for (QuizParser.Parsed q : parser.parse(content)) {
                Question entity = new Question();
                entity.setCourse(course);
                entity.setSection(q.section());
                entity.setQuestionNumber(q.questionNumber());
                entity.setQtype(q.qtype());
                entity.setQuestion(q.question());
                if (q.options() != null) {
                    List<String> o = q.options();
                    entity.setOption1(o.get(0));
                    entity.setOption2(o.get(1));
                    entity.setOption3(o.get(2));
                    entity.setOption4(o.get(3));
                }
                entity.setCorrectOption(q.correctOption());
                entity.setAnswer(q.answer());
                course.getQuestions().add(entity);
            }
        }
        course.setArchived(false);
        courses.save(course);
        return Map.of("saved", base);
    }

    @GetMapping("/courses/{name}/questions")
    public List<Dto.QuestionResponse> questions(@AuthUser User user, @PathVariable String name) {
        Course course = courses.findByUserIdAndName(user.getId(), name).orElse(null);
        if (course == null) {
            return List.of();
        }
        List<Dto.QuestionResponse> out = new ArrayList<>();
        for (Question q : course.getQuestions()) {
            if ("qa".equals(q.getQtype())) {
                out.add(new Dto.QuestionResponse(q.getSection(), String.valueOf(q.getQuestionNumber()),
                        q.getQuestion(), "qa", null, null, q.getAnswer()));
            } else {
                List<String> options = new ArrayList<>();
                options.add(q.getOption1());
                options.add(q.getOption2());
                options.add(q.getOption3());
                options.add(q.getOption4());
                out.add(new Dto.QuestionResponse(q.getSection(), String.valueOf(q.getQuestionNumber()),
                        q.getQuestion(), "mcq", options, q.getCorrectOption(), null));
            }
        }
        return out;
    }

    @GetMapping("/courses/{name}/notes")
    public Dto.NotesResponse notes(@AuthUser User user, @PathVariable String name) {
        Course course = courses.findByUserIdAndName(user.getId(), name).orElse(null);
        String content = course != null && course.getNotes() != null ? course.getNotes() : "";
        return new Dto.NotesResponse(!content.isEmpty(), content);
    }

    @PostMapping("/archive/{name}")
    public Map<String, Object> archive(@AuthUser User user, @PathVariable String name) {
        Course course = courses.findByUserIdAndName(user.getId(), name).orElse(null);
        if (course != null && !course.isArchived()) {
            answers.deleteByCourseId(course.getId());
            course.setArchived(true);
            courses.save(course);
        }
        return Map.of("archived", name, "archive", names(user, true));
    }

    @PostMapping("/archive/{name}/revive")
    public Map<String, Object> revive(@AuthUser User user, @PathVariable String name) {
        Course course = courses.findByUserIdAndName(user.getId(), name).orElse(null);
        if (course != null && course.isArchived()) {
            course.setArchived(false);
            courses.save(course);
        }
        return Map.of("revived", name, "archive", names(user, true));
    }

    @org.springframework.web.bind.annotation.DeleteMapping("/archive/{name}")
    public Map<String, Object> purge(@AuthUser User user, @PathVariable String name) {
        Course course = courses.findByUserIdAndName(user.getId(), name).orElse(null);
        if (course != null && course.isArchived()) {
            courses.delete(course);
        }
        return Map.of("purged", name, "archive", names(user, true));
    }

    private List<String> names(User user, boolean archived) {
        List<String> result = new ArrayList<>();
        for (Course c : courses.findByUserIdAndArchivedOrderByNameAsc(user.getId(), archived)) {
            result.add(c.getName());
        }
        return result;
    }
}
