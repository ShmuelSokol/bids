-- dbo.web_rfq_line_1_view



/* view web_rfq_line_1_view: add view */


/* view web_rfq_line_1_view: add view */


/* view web_rfq_line_1_view: add view */

/* view web_rfq_line_1_view: add view */


/* view web_rfq_line_1_view: add view */


/* view web_rfq_line_1_view: add view */


/* view web_rfq_line_1_view: add view */


/* view web_rfq_line_1_view: add view */


/* view web_rfq_line_1_view: add view */


/* view web_rfq_line_1_view: add view */


/* view web_rfq_line_1_view: add view */


/* view web_rfq_line_1_view: add view */


/* view web_rfq_line_1_view: add view */


/* view web_rfq_line_1_view: add view */


/* view web_rfq_line_1_view: add view */


/* view web_rfq_line_1_view: add view */


/* view web_rfq_line_1_view: add view */


/* view web_rfq_line_1_view: add view */
CREATE VIEW [dbo].[web_rfq_line_1_view]
AS
SELECT     dbo.k08_tab.fsc_k08, dbo.k08_tab.niin_k08, dbo.k08_tab.p_desc_k08, dbo.k08_tab.p_cage_k08, dbo.k08_tab.partno_k08, dbo.k12_tab.e_name_k12 AS f_name_qtr, 
                      dbo.k13_tab.cage_k13 AS e_code_rfq, dbo.k13_tab.c_name_k13 AS e_name_rfq, dbo.kd0_tab.s07dte_kd0, dbo.kd0_tab.qrefno_kd0, dbo.kd0_tab.q_type_kd0, 
                      dbo.kd0_tab.m_cage_kd0, dbo.kd0_tab.mfg_pn_kd0, dbo.kd0_tab.pn_rev_kd0, dbo.kd0_tab.qotqty_kd0, dbo.kd0_tab.untcst_kd0, dbo.kd0_tab.dlyaro_kd0, 
                      dbo.kd0_tab.valday_kd0, dbo.kd0_tab.fobtyp_kd0, dbo.kd0_tab.fobzip_kd0, dbo.k08_tab.idnk08_k08, dbo.kd0_tab.idnkd0_kd0, dbo.kd0_tab.idns07_kd0, 
                      dbo.k13_tab.idnk13_k13
FROM         dbo.k08_tab INNER JOIN
                      dbo.kd0_tab ON dbo.k08_tab.idnk08_k08 = dbo.kd0_tab.idnk08_kd0 INNER JOIN
                      dbo.k14_tab ON dbo.kd0_tab.qtrk14_kd0 = dbo.k14_tab.idnk14_k14 INNER JOIN
                      dbo.k12_tab ON dbo.k14_tab.idnk12_k14 = dbo.k12_tab.idnk12_k12 INNER JOIN
                      dbo.k13_tab ON dbo.kd0_tab.rfqk13_kd0 = dbo.k13_tab.idnk13_k13


















