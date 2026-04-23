-- dbo.qa_inspection_line_1_view



/* view qa_inspection_line_1_view: add view */


/* view qa_inspection_line_1_view: add view */


/* view qa_inspection_line_1_view: add view */

/* view qa_inspection_line_1_view: add view */


/* view qa_inspection_line_1_view: add view */


/* view qa_inspection_line_1_view: add view */


/* view qa_inspection_line_1_view: add view */


/* view qa_inspection_line_1_view: add view */


/* view qa_inspection_line_1_view: add view */


/* view qa_inspection_line_1_view: add view */


/* view qa_inspection_line_1_view: add view */


/* view qa_inspection_line_1_view: add view */


/* view qa_inspection_line_1_view: add view */


/* view qa_inspection_line_1_view: add view */


/* view qa_inspection_line_1_view: add view */


/* view qa_inspection_line_1_view: add view */


/* view qa_inspection_line_1_view: add view */


/* view qa_inspection_line_1_view: add view */
CREATE VIEW [dbo].[qa_inspection_line_1_view]
AS
SELECT     dbo.kcp_tab.qai_no_kcp, dbo.kcp_tab.qainum_kcp, dbo.kcp_tab.qaixml_kcp, dbo.kcq_tab.qal_no_kcq, dbo.kcq_tab.qastat_kcq, dbo.kcq_tab.qalxml_kcq, 
                      dbo.login_user_1_view.u_name_k14 AS u_name_iby, login_user_1_view_1.u_name_k14 AS u_name_aby, dbo.login_user_1_view.idnk14_k14 AS idnk14_iby, 
                      login_user_1_view_1.idnk14_k14 AS idnk14_aby, dbo.part_2_view.idnk71_k71, dbo.kcq_tab.dc1tab_kcq, dbo.kcq_tab.idndc1_kcq, dbo.kcq_tab.dc2tab_kcq, 
                      dbo.kcq_tab.idndc2_kcq, dbo.kcp_tab.idnkcp_kcp, dbo.kcq_tab.idnkcq_kcq, dbo.kcp_tab.qaista_kcp, dbo.part_2_view.fsc_k08, dbo.part_2_view.niin_k08, 
                      dbo.part_2_view.prtnum_k71, dbo.part_2_view.pn_rev_k71, dbo.part_2_view.p_desc_k71, dbo.part_2_view.e_code_mfg, dbo.kcq_tab.idnk71_kcq
FROM         dbo.login_user_1_view AS login_user_1_view_1 INNER JOIN
                      dbo.login_user_1_view INNER JOIN
                      dbo.kcp_tab INNER JOIN
                      dbo.kcq_tab ON dbo.kcp_tab.idnkcp_kcp = dbo.kcq_tab.idnkcp_kcq ON dbo.login_user_1_view.idnk14_k14 = dbo.kcq_tab.ibyk14_kcq ON 
                      login_user_1_view_1.idnk14_k14 = dbo.kcq_tab.abyk14_kcq INNER JOIN
                      dbo.part_2_view ON dbo.kcq_tab.idnk71_kcq = dbo.part_2_view.idnk71_k71


















