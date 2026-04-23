-- dbo.vendor_quote_3a_view



/* view vendor_quote_3a_view: add view */


/* view vendor_quote_3a_view: add view */


/* view vendor_quote_3a_view: add view */
CREATE VIEW dbo.vendor_quote_3a_view
AS
SELECT        K12_tab.e_name_k12, K39_tab.s_code_k39, K42_tab.rfq_no_k42, K42_tab.rfquno_k42, K42_tab.addtme_k42, K42_tab.rrqsta_k42, K42_tab.itmcnt_k42, K43_tab.rqpsta_k43, K43_tab.rqptme_k43, K08_tab.partno_k08, 
                         K08_tab.p_cage_k08, K08_tab.p_desc_k08, K08_tab.fsc_k08, K08_tab.niin_k08, K56_tab.q_type_k56, K56_tab.p_um_k56, K56_tab.qfactr_k56, K56_tab.p_note_k56, K08_tab.idnk08_k08, K12_tab.idnk12_k12, 
                         K39_tab.idnk39_k39, K42_tab.idnk42_k42, K43_tab.idnk43_k43, K56_tab.idnk56_k56, K56_tab.p_cage_k56, K56_tab.partno_k56, K56_tab.su_lbs_k56, K56_tab.uptime_k56, K56_tab.upname_k56, dbo.k55_tab.idnk55_k55, 
                         dbo.k55_tab.qotdte_k55, dbo.k55_tab.q_note_k55, K42_tab.uptime_k42, dbo.k55_tab.qrefno_k55, K40_tab.spncge_k40, K40_tab.spnnum_k40, K40_tab.idnk40_k40
FROM            dbo.k42_tab AS K42_tab INNER JOIN
                         dbo.k43_tab AS K43_tab LEFT OUTER JOIN
                         dbo.k56_tab AS K56_tab ON K43_tab.idnk43_k43 = K56_tab.idnk43_k56 ON K42_tab.idnk42_k42 = K43_tab.idnk42_k43 INNER JOIN
                         dbo.k39_tab AS K39_tab ON K42_tab.idnk39_k42 = K39_tab.idnk39_k39 LEFT OUTER JOIN
                         dbo.k12_tab AS K12_tab ON K39_tab.idnk12_k39 = K12_tab.idnk12_k12 LEFT OUTER JOIN
                         dbo.k40_tab AS K40_tab ON K43_tab.idnk40_k43 = K40_tab.idnk40_k40 LEFT OUTER JOIN
                         dbo.k08_tab AS K08_tab ON K40_tab.idnk08_k40 = K08_tab.idnk08_k08 LEFT OUTER JOIN
                         dbo.k55_tab ON K56_tab.idnk55_k56 = dbo.k55_tab.idnk55_k55



