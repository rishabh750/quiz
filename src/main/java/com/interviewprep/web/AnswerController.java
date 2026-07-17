package com.interviewprep.web;

import java.util.ArrayList;
import java.util.List;

import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.interviewprep.model.Answer;
import com.interviewprep.model.Course;
import com.interviewprep.model.User;
import com.interviewprep.repo.AnswerRepository;
import com.interviewprep.repo.CourseRepository;
import com.interviewprep.security.ApiException;
import com.interviewprep.security.AuthUser;

@RestController
@RequestMapping("/api")
@Transactional
public class AnswerController {

    private final CourseRepository courses;
    private final AnswerRepository answers;

    public AnswerController(CourseRepository courses, AnswerRepository answers) {
        this.courses = courses;
        this.answers = answers;
    }

    @GetMapping("/answers/{name}")
    public List<Dto.AnswerResponse> get(@AuthUser User user, @PathVariable String name) {
        return serialize(course(user, name));
    }

    @PostMapping("/answers/{name}")
    public List<Dto.AnswerResponse> save(@AuthUser User user, @PathVariable String name,
                                         @RequestBody Dto.AnswerRequest body) {
        Course course = course(user, name);
        int qnum = toInt(body.questionNumber());
        Answer row = answers.findByCourseIdAndQuestionNumber(course.getId(), qnum);
        if (row == null) {
            row = new Answer();
            row.setCourse(course);
            row.setQuestionNumber(qnum);
        }
        row.setCandidateAnswer(String.valueOf(body.candidateAnswer()));
        row.setMarks(body.marks() == null ? 0 : body.marks());
        answers.save(row);
        return serialize(course);
    }

    @DeleteMapping("/answers/{name}")
    public List<Dto.AnswerResponse> reset(@AuthUser User user, @PathVariable String name,
                                          @RequestBody(required = false) Dto.ResetRequest body) {
        Course course = course(user, name);
        if (body != null && body.questionNumbers() != null && !body.questionNumbers().isEmpty()) {
            List<Integer> nums = new ArrayList<>();
            for (String n : body.questionNumbers()) {
                nums.add(toInt(n));
            }
            answers.deleteByCourseIdAndQuestionNumberIn(course.getId(), nums);
        } else {
            answers.deleteByCourseId(course.getId());
        }
        return serialize(course);
    }

    private Course course(User user, String name) {
        return courses.findByUserIdAndName(user.getId(), name)
                .orElseThrow(() -> new ApiException(404, "course not found"));
    }

    private List<Dto.AnswerResponse> serialize(Course course) {
        List<Dto.AnswerResponse> out = new ArrayList<>();
        for (Answer a : answers.findByCourseIdOrderByQuestionNumberAsc(course.getId())) {
            out.add(new Dto.AnswerResponse(String.valueOf(a.getQuestionNumber()),
                    a.getCandidateAnswer(), a.getMarks()));
        }
        return out;
    }

    private int toInt(Object value) {
        return Integer.parseInt(String.valueOf(value).trim());
    }
}
