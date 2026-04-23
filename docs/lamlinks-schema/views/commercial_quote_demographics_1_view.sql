-- dbo.commercial_quote_demographics_1_view



/* view commercial_quote_demographics_1_view: add view */


/* view commercial_quote_demographics_1_view: add view */


/* view commercial_quote_demographics_1_view: add view */

/* view commercial_quote_demographics_1_view: add view */


/* view commercial_quote_demographics_1_view: add view */
CREATE VIEW [dbo].[commercial_quote_demographics_1_view]
AS
SELECT        dbo.kd9_tab.q_stat_kd9, dbo.credential_control_1_view.c_stat_kdg, dbo.kdh_tab.q_mode_kdh, dbo.k06_tab.idnk06_k06, dbo.k06_tab.trmdes_k06, dbo.customer_demographics_1_view.gduset_ka7, 
                         dbo.customer_demographics_1_view.d_code_ka7, dbo.customer_demographics_1_view.d_name_ka7, dbo.customer_demographics_1_view.d_attn_ka7, dbo.customer_demographics_1_view.d_emal_ka7, 
                         dbo.customer_demographics_1_view.idnk12_k12, dbo.kd9_tab.idnkd9_kd9
FROM            dbo.k06_tab INNER JOIN
                         dbo.kdh_tab ON dbo.k06_tab.idnk06_k06 = dbo.kdh_tab.idnk06_kdh INNER JOIN
                         dbo.kd9_tab INNER JOIN
                         dbo.customer_demographics_1_view INNER JOIN
                         dbo.ka6_tab ON dbo.customer_demographics_1_view.idnka7_ka7 = dbo.ka6_tab.idnka7_ka6 ON dbo.kd9_tab.k12ptr_kd9 = dbo.ka6_tab.idngdu_ka6 ON 
                         dbo.kdh_tab.idnk12_kdh = dbo.customer_demographics_1_view.idnk12_ka7 INNER JOIN
                         dbo.credential_control_1_view ON dbo.customer_demographics_1_view.idnka7_ka7 = dbo.credential_control_1_view.idntoa_kdg
WHERE        (dbo.ka6_tab.gdutbl_ka6 = 'k12') AND (dbo.credential_control_1_view.tbltoa_kdg = 'ka7')





